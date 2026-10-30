const mongoose = require('mongoose');
const Order = require('../models/Order.model');
const PizzaOption = require('../models/PizzaOption.model');
const paymentService = require('../services/payment.service');
const inventoryService = require('../services/inventory.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Order Controller
 * Manages order creation, price computation, Razorpay test payment,
 * server-side signature verification, and atomic inventory decrements.
 * Plan Reference: project_plan.md §6.5, §7.3, §9.6, §10.3, §13, §15.2
 */

/**
 * Validates pizza options, computes authoritative price from DB,
 * checks inventory, creates a Razorpay order, and saves a pending Order.
 * POST /api/orders/create-razorpay-order
 */
const createRazorpayOrder = async (req, res) => {
  try {
    const {
      base,
      sauce,
      cheese,
      vegetables = [],
    } = req.body;

    // 1. Validate required component IDs
    if (!base || !sauce || !cheese) {
      return errorResponse(res, 'Base, sauce, and cheese selections are required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(base)
      || !mongoose.Types.ObjectId.isValid(sauce)
      || !mongoose.Types.ObjectId.isValid(cheese)) {
      return errorResponse(res, 'Invalid ID format for base, sauce, or cheese', 400);
    }

    if (!Array.isArray(vegetables)) {
      return errorResponse(res, 'Vegetables must be an array of option IDs', 400);
    }

    // Deduplicate vegetable IDs to prevent duplicate billing or decrements
    const uniqueVegIds = Array.from(new Set(vegetables));
    for (let i = 0; i < uniqueVegIds.length; i += 1) {
      if (!mongoose.Types.ObjectId.isValid(uniqueVegIds[i])) {
        return errorResponse(res, `Invalid vegetable option ID: ${uniqueVegIds[i]}`, 400);
      }
    }

    // 2. Fetch authoritative PizzaOption records from database
    const vegQuery = uniqueVegIds.length > 0
      ? PizzaOption.find({ _id: { $in: uniqueVegIds } })
      : Promise.resolve([]);

    const [baseOption, sauceOption, cheeseOption, vegOptions] = await Promise.all([
      PizzaOption.findById(base),
      PizzaOption.findById(sauce),
      PizzaOption.findById(cheese),
      vegQuery,
    ]);

    // 3. Verify existence and availability
    if (!baseOption || !baseOption.isAvailable) {
      return errorResponse(res, 'Selected base option is not available or does not exist', 400);
    }
    if (!sauceOption || !sauceOption.isAvailable) {
      return errorResponse(res, 'Selected sauce option is not available or does not exist', 400);
    }
    if (!cheeseOption || !cheeseOption.isAvailable) {
      return errorResponse(res, 'Selected cheese option is not available or does not exist', 400);
    }
    if (vegOptions.length !== uniqueVegIds.length) {
      return errorResponse(res, 'One or more selected vegetable options do not exist', 400);
    }
    const unavailableVeg = vegOptions.find((v) => !v.isAvailable);
    if (unavailableVeg) {
      return errorResponse(res, `Vegetable option ${unavailableVeg.name} is not available`, 400);
    }

    // 4. Verify categories match expectations
    if (baseOption.category !== 'base') {
      return errorResponse(res, `Option ${baseOption.name} is not a valid base`, 400);
    }
    if (sauceOption.category !== 'sauce') {
      return errorResponse(res, `Option ${sauceOption.name} is not a valid sauce`, 400);
    }
    if (cheeseOption.category !== 'cheese') {
      return errorResponse(res, `Option ${cheeseOption.name} is not a valid cheese`, 400);
    }
    const mismatchedVeg = vegOptions.find((v) => v.category !== 'vegetable');
    if (mismatchedVeg) {
      return errorResponse(res, `Option ${mismatchedVeg.name} is not a valid vegetable`, 400);
    }

    // 5. Server-side authoritative price computation
    const vegTotal = vegOptions.reduce((acc, v) => acc + (v.basePrice || 0), 0);
    const totalPrice = (baseOption.basePrice || 0)
      + (sauceOption.basePrice || 0)
      + (cheeseOption.basePrice || 0)
      + vegTotal;

    // 6. Pre-payment stock check in InventoryItem
    const allOptionIds = [
      baseOption._id,
      sauceOption._id,
      cheeseOption._id,
      ...vegOptions.map((v) => v._id),
    ];
    const stockStatus = await inventoryService.checkStock(allOptionIds);
    if (!stockStatus.available) {
      return errorResponse(res, `Ingredient out of stock: ${stockStatus.missingItem}`, 409);
    }

    // 7. Create Razorpay order in paise
    const amountPaise = Math.round(totalPrice * 100);
    let rzpOrder;
    try {
      rzpOrder = await paymentService.createRazorpayOrder(amountPaise, 'INR');
    } catch (rzpErr) {
      console.error('Razorpay SDK order creation error:', rzpErr);
      return errorResponse(res, 'Failed to create payment order with payment gateway', 502);
    }

    // 8. Save pending Order document
    const order = await Order.create({
      customer: req.user._id,
      items: {
        base: baseOption._id,
        sauce: sauceOption._id,
        cheese: cheeseOption._id,
        vegetables: vegOptions.map((v) => v._id),
      },
      totalPrice,
      paymentStatus: 'pending',
      orderStatus: 'Order Received',
      razorpayOrderId: rzpOrder.id,
    });

    return successResponse(
      res,
      {
        razorpayOrderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        orderId: order._id,
      },
      201,
    );
  } catch (err) {
    console.error('Error in createRazorpayOrder:', err);
    return errorResponse(res, 'Internal server error creating order', 500);
  }
};

/**
 * Verifies Razorpay HMAC-SHA256 signature, enforces idempotency,
 * re-checks stock, and atomically confirms payment + decrements inventory.
 * POST /api/orders/verify-payment
 */
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    // 1. Validate required inputs
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return errorResponse(
        res,
        'razorpayOrderId, razorpayPaymentId, and razorpaySignature are required',
        400,
      );
    }

    // 2. Server-side HMAC-SHA256 signature verification
    const isValidSignature = paymentService.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );
    if (!isValidSignature) {
      return errorResponse(res, 'Invalid payment signature', 400);
    }

    // 3. Look up order by razorpayOrderId
    const order = await Order.findOne({ razorpayOrderId });
    if (!order) {
      return errorResponse(res, 'Order not found for given Razorpay order ID', 404);
    }

    // 4. Ownership verification: ensure order belongs to authenticated customer
    if (order.customer.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'Unauthorized: order belongs to another customer', 403);
    }

    // 5. Idempotency check: if already confirmed, return success without side effects
    if (order.paymentStatus === 'paid') {
      return successResponse(
        res,
        {
          orderId: order._id,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          alreadyConfirmed: true,
        },
        200,
      );
    }

    // 6. Re-check stock levels to prevent race conditions during payment
    const allOptionIds = [
      order.items.base,
      order.items.sauce,
      order.items.cheese,
      ...(order.items.vegetables || []),
    ];
    const postStockCheck = await inventoryService.checkStock(allOptionIds);
    if (!postStockCheck.available) {
      return errorResponse(
        res,
        `Ingredient out of stock during payment verification: ${postStockCheck.missingItem}`,
        409,
      );
    }

    // 7. Atomic confirmation and inventory decrement
    const isTxAvailable = global.TRANSACTION_AVAILABLE !== false;

    if (isTxAvailable) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        // Decrement stock for all pizza ingredients within transaction session
        await inventoryService.decrementStock(allOptionIds, session);

        // Update order state to paid
        order.paymentStatus = 'paid';
        order.razorpayPaymentId = razorpayPaymentId;
        order.razorpaySignature = razorpaySignature;
        order.updatedAt = new Date();
        await order.save({ session });

        await session.commitTransaction();
      } catch (txErr) {
        await session.abortTransaction();
        console.error('Transaction aborted during payment verification:', txErr);
        return errorResponse(res, 'Failed to confirm order in database transaction', 500);
      } finally {
        session.endSession();
      }
    } else {
      // Fallback sequenced write strategy per project_plan.md §9.7
      order.paymentStatus = 'paid';
      order.razorpayPaymentId = razorpayPaymentId;
      order.razorpaySignature = razorpaySignature;
      order.updatedAt = new Date();
      await order.save();

      // Decrement stock individually (sequenced fallback)
      await inventoryService.decrementStock(allOptionIds, null, order._id);
    }

    return successResponse(
      res,
      {
        orderId: order._id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
      },
      200,
    );
  } catch (err) {
    console.error('Error in verifyPayment:', err);
    return errorResponse(res, 'Internal server error verifying payment', 500);
  }
};

/**
 * Returns authenticated customer's orders, sorted newest first.
 * GET /api/orders/my-orders
 */
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .select('-razorpaySignature')
      .populate('items.base')
      .populate('items.sauce')
      .populate('items.cheese')
      .populate('items.vegetables')
      .sort({ createdAt: -1 });

    return successResponse(res, { orders }, 200);
  } catch (err) {
    console.error('Error in getMyOrders:', err);
    return errorResponse(res, 'Failed to retrieve customer orders', 500);
  }
};

/**
 * Returns orderStatus and tracking summary for customer polling.
 * Validates that order exists, orderId is valid ObjectId, and order belongs to req.user.
 * GET /api/orders/:orderId/status
 */
const getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return errorResponse(res, 'Invalid order ID format', 400);
    }

    const order = await Order.findById(orderId)
      .select('-razorpaySignature')
      .populate('items.base')
      .populate('items.sauce')
      .populate('items.cheese')
      .populate('items.vegetables');

    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    if (order.customer.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'Unauthorized: order belongs to another customer', 403);
    }

    return successResponse(
      res,
      {
        orderId: order._id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        totalPrice: order.totalPrice,
        items: order.items,
      },
      200,
    );
  } catch (err) {
    console.error('Error in getOrderStatus:', err);
    return errorResponse(res, 'Failed to retrieve order status', 500);
  }
};

module.exports = {
  createRazorpayOrder,
  verifyPayment,
  getMyOrders,
  getOrderStatus,
};
