const mongoose = require('mongoose');
const Order = require('../models/Order.model');
const PizzaOption = require('../models/PizzaOption.model');
const paymentService = require('../services/payment.service');
const inventoryService = require('../services/inventory.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Order Controller
 * Manages order creation, price computation in ETB, Chapa test payment initialization,
 * authoritative server-side verification, idempotent finalization, and atomic inventory decrements.
 */

/**
 * Helper to finalize an order payment idempotently.
 * Validates transaction data, checks stock, atomically decrements inventory, and marks order paid.
 *
 * @param {Order} order - Mongoose order document
 * @param {object} verificationData - Verified data from Chapa API
 * @returns {Promise<{ order: Order, alreadyPaid: boolean }>}
 */
/* eslint-disable no-param-reassign */
const finalizeOrderPayment = async (order, verificationData) => {
  // 1. Idempotency check: if already confirmed, do not double-decrement or modify
  if (order.paymentStatus === 'paid') {
    return { order, alreadyPaid: true };
  }

  // 2. Validate payment status
  const paidStatus = (verificationData.status || '').toLowerCase();
  if (paidStatus === 'pending') {
    const err = new Error('Payment is still pending with Chapa. Please complete the transaction.');
    err.statusCode = 400;
    err.code = 'PAYMENT_PENDING';
    throw err;
  }
  if (paidStatus !== 'success') {
    order.paymentStatus = 'failed';
    await order.save();
    const err = new Error(`Payment verification failed: status is ${paidStatus}`);
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate currency
  const paidCurrency = (verificationData.currency || '').toUpperCase();
  if (paidCurrency !== 'ETB') {
    order.paymentStatus = 'failed';
    await order.save();
    const err = new Error(`Currency mismatch: expected ETB, received ${paidCurrency}`);
    err.statusCode = 400;
    throw err;
  }

  // 4. Validate authoritative amount
  const expectedAmount = Number(order.totalPrice);
  const paidAmount = Number(verificationData.amount);
  if (Math.abs(expectedAmount - paidAmount) > 0.01) {
    order.paymentStatus = 'failed';
    await order.save();
    const err = new Error(
      `Payment amount mismatch: expected ${expectedAmount} ETB, got ${paidAmount} ETB`,
    );
    err.statusCode = 400;
    throw err;
  }

  // 5. Re-check stock levels to prevent race conditions during checkout
  const allOptionIds = [
    order.items.base,
    order.items.sauce,
    order.items.cheese,
    ...(order.items.vegetables || []),
  ];

  const postStockCheck = await inventoryService.checkStock(allOptionIds);
  if (!postStockCheck.available) {
    order.paymentStatus = 'failed';
    await order.save();
    const err = new Error(
      `Ingredient out of stock during payment verification: ${postStockCheck.missingItem}`,
    );
    err.statusCode = 409;
    throw err;
  }

  // 6. Atomic confirmation and inventory decrement
  const isTxAvailable = global.TRANSACTION_AVAILABLE !== false;

  if (isTxAvailable) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Decrement stock within transaction session
      await inventoryService.decrementStock(allOptionIds, session);

      // Update order state
      order.paymentStatus = 'paid';
      order.paymentReference = verificationData.reference || null;
      order.paidAt = new Date();
      order.updatedAt = new Date();
      await order.save({ session });

      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }
  } else {
    // Fallback sequenced write strategy for standalone / non-replica MongoDB
    order.paymentStatus = 'paid';
    order.paymentReference = verificationData.reference || null;
    order.paidAt = new Date();
    order.updatedAt = new Date();
    await order.save();

    await inventoryService.decrementStock(allOptionIds, null, order._id);
  }

  return { order, alreadyPaid: false };
};

/**
 * Validates pizza options, computes authoritative price in ETB from DB,
 * checks inventory, initializes a Chapa hosted checkout session, and creates a pending Order.
 * POST /api/orders/create-order or POST /api/orders/create-chapa-order
 */
const createOrder = async (req, res) => {
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

    // 5. Server-side authoritative price computation in ETB
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

    // 7. Generate a unique transaction reference and create pending Order
    const dummyOrderId = new mongoose.Types.ObjectId();
    const txRef = paymentService.generateTxRef();

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const serverPort = process.env.PORT || 5001;
    const serverOrigin = process.env.SERVER_ORIGIN || `http://localhost:${serverPort}`;

    let returnUrl = `${clientOrigin}/payment?tx_ref=${encodeURIComponent(txRef)}`;
    if (process.env.CHAPA_RETURN_URL) {
      const baseReturn = process.env.CHAPA_RETURN_URL.replace(/\/+$/, '');
      returnUrl = baseReturn.includes('tx_ref=')
        ? baseReturn
        : `${baseReturn}?tx_ref=${encodeURIComponent(txRef)}`;
    }
    const callbackUrl = process.env.CHAPA_CALLBACK_URL
      || `${serverOrigin}/api/orders/chapa/webhook`;

    // Split customer name
    const nameParts = (req.user.name || 'Customer').trim().split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    // 8. Initialize transaction with Chapa
    let chapaResponse;
    try {
      chapaResponse = await paymentService.initializeTransaction({
        amount: totalPrice,
        currency: 'ETB',
        email: req.user.email,
        firstName,
        lastName,
        txRef,
        callbackUrl,
        returnUrl,
      });
    } catch (chapaErr) {
      console.error('Chapa API transaction initialization error:', chapaErr);
      return errorResponse(
        res,
        'Failed to initialize payment with Chapa payment gateway',
        502,
      );
    }

    // 9. Persist pending Order document
    const order = await Order.create({
      _id: dummyOrderId,
      customer: req.user._id,
      items: {
        base: baseOption._id,
        sauce: sauceOption._id,
        cheese: cheeseOption._id,
        vegetables: vegOptions.map((v) => v._id),
      },
      totalPrice,
      currency: 'ETB',
      paymentStatus: 'pending',
      orderStatus: 'Order Received',
      paymentProvider: 'chapa',
      txRef,
    });

    return successResponse(
      res,
      {
        orderId: order._id,
        txRef,
        amount: order.totalPrice,
        currency: 'ETB',
        checkoutUrl: chapaResponse.checkoutUrl,
      },
      201,
      'Order created and payment session initialized successfully',
    );
  } catch (err) {
    console.error('Error in createOrder:', err);
    return errorResponse(res, 'Internal server error creating order', 500);
  }
};

/**
 * Verifies Chapa transaction server-side, validates txRef, amount, and currency,
 * and atomically confirms payment + decrements inventory.
 * POST /api/orders/verify-payment
 */
const verifyPayment = async (req, res) => {
  try {
    const txRef = req.body.txRef || req.body.tx_ref;
    const { orderId } = req.body;

    if (!txRef && !orderId) {
      return errorResponse(res, 'txRef or orderId is required for payment verification', 400);
    }

    // Find order by txRef or orderId
    const query = txRef ? { txRef } : { _id: orderId };
    const order = await Order.findOne(query);

    if (!order) {
      return errorResponse(res, 'Order not found for given transaction reference', 404);
    }

    // Verify ownership
    if (order.customer.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'Unauthorized: order belongs to another customer', 403);
    }

    // Idempotency check: if already confirmed, return success
    if (order.paymentStatus === 'paid') {
      return successResponse(
        res,
        {
          orderId: order._id,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          total: order.totalPrice,
          currency: order.currency || 'ETB',
          alreadyConfirmed: true,
        },
        200,
        'Payment already verified and confirmed',
      );
    }

    // Server-side authoritative verification directly with Chapa API
    let verificationData;
    try {
      verificationData = await paymentService.verifyTransaction(order.txRef);
    } catch (vErr) {
      console.error('Chapa transaction verification error:', vErr.message);
      return errorResponse(res, `Failed to verify payment with Chapa: ${vErr.message}`, 400);
    }

    const { alreadyPaid } = await finalizeOrderPayment(order, verificationData);

    return successResponse(
      res,
      {
        orderId: order._id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        total: order.totalPrice,
        currency: order.currency || 'ETB',
        alreadyConfirmed: alreadyPaid,
      },
      200,
      'Payment verified and order confirmed successfully',
    );
  } catch (err) {
    console.error('Error in verifyPayment:', err);
    const statusCode = err.statusCode || 500;
    return errorResponse(res, err.message || 'Internal server error verifying payment', statusCode);
  }
};

/**
 * Verification endpoint via route param:
 * GET /api/orders/verify/:txRef
 */
const verifyPaymentByParam = async (req, res) => {
  req.body = { ...req.body, txRef: req.params.txRef };
  return verifyPayment(req, res);
};

/**
 * Server-to-server webhook callback from Chapa.
 * POST /api/orders/chapa/webhook or POST /api/orders/webhook
 */
const handleChapaWebhook = async (req, res) => {
  try {
    const txRef = req.body?.tx_ref || req.body?.txRef;
    if (!txRef) {
      return errorResponse(res, 'Missing tx_ref in webhook payload', 400);
    }

    const order = await Order.findOne({ txRef });
    if (!order) {
      return errorResponse(res, 'Order not found for given tx_ref', 404);
    }

    if (order.paymentStatus === 'paid') {
      return res.status(200).json({ status: 'already_paid' });
    }

    // Authoritative direct check with Chapa
    const verificationData = await paymentService.verifyTransaction(txRef);
    await finalizeOrderPayment(order, verificationData);

    return res.status(200).json({
      status: 'success',
      orderId: order._id,
    });
  } catch (err) {
    console.error('Chapa webhook processing error:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message,
    });
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
 * GET /api/orders/:orderId/status
 */
const getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return errorResponse(res, 'Invalid order ID format', 400);
    }

    const order = await Order.findById(orderId)
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
        currency: order.currency || 'ETB',
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
  createOrder,
  createChapaOrder: createOrder, // Alias for clear naming
  verifyPayment,
  verifyPaymentByParam,
  handleChapaWebhook,
  getMyOrders,
  getOrderStatus,
};
