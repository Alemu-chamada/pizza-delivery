const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem.model');
const Order = require('../models/Order.model');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const VALID_ORDER_STATUSES = ['Order Received', 'In Kitchen', 'Sent to Delivery'];

/**
 * Admin Controller
 * Provides administrative inventory oversight, manual stock adjustment,
 * customer order tracking, and order status transitions.
 * Plan Reference: project_plan.md §4.2, §6.8, §6.9, §10.4, §12.5 (FR-A03, FR-A05, FR-A07, FR-A08)
 */

/**
 * Retrieve all inventory items with linked pizza option details and low-stock indicators.
 * GET /api/admin/inventory
 */
const getInventory = async (req, res) => {
  try {
    const items = await InventoryItem.find()
      .populate('linkedPizzaOption')
      .sort({ category: 1, name: 1 });

    const formattedItems = items.map((item) => {
      const isLowStock = item.currentStock < item.lowStockThreshold;
      const doc = item.toObject ? item.toObject() : item;
      return {
        ...doc,
        isLowStock,
      };
    });

    const lowStockCount = formattedItems.filter((i) => i.isLowStock).length;

    return successResponse(
      res,
      {
        inventory: formattedItems,
        items: formattedItems,
        count: formattedItems.length,
        lowStockCount,
      },
      200,
    );
  } catch (error) {
    console.error('Error in getInventory:', error);
    return errorResponse(res, 'Failed to retrieve inventory items', 500);
  }
};

/**
 * Manually update the stock quantity of a specific inventory item.
 * PATCH /api/admin/inventory/:itemId
 * Request Body: { currentStock: Number }
 */
const updateInventoryItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { currentStock } = req.body;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return errorResponse(res, 'Invalid inventory item ID format', 400);
    }

    if (currentStock === undefined || currentStock === null || currentStock === '') {
      return errorResponse(res, 'currentStock is required in request body', 400);
    }

    const stockNum = Number(currentStock);
    if (!Number.isFinite(stockNum) || Number.isNaN(stockNum) || stockNum < 0) {
      return errorResponse(res, 'currentStock must be a non-negative number', 400);
    }

    const item = await InventoryItem.findById(itemId);
    if (!item) {
      return errorResponse(res, 'Inventory item not found', 404);
    }

    item.currentStock = stockNum;
    item.updatedAt = new Date();
    await item.save();

    await item.populate('linkedPizzaOption');

    const isLowStock = item.currentStock < item.lowStockThreshold;
    const itemData = {
      ...(item.toObject ? item.toObject() : item),
      isLowStock,
    };

    return successResponse(
      res,
      {
        item: itemData,
        inventoryItem: itemData,
        isLowStock,
      },
      200,
      'Inventory stock updated successfully',
    );
  } catch (error) {
    console.error('Error in updateInventoryItem:', error);
    return errorResponse(res, 'Failed to update inventory stock', 500);
  }
};

/**
 * Retrieve all customer orders, sorted newest first, with populated customer and item details.
 * Strictly excludes sensitive razorpaySignature.
 * GET /api/admin/orders
 */
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .select('-razorpaySignature')
      .populate('customer', 'name email')
      .populate('items.base')
      .populate('items.sauce')
      .populate('items.cheese')
      .populate('items.vegetables')
      .sort({ createdAt: -1 });

    return successResponse(
      res,
      {
        orders,
        count: orders.length,
      },
      200,
    );
  } catch (error) {
    console.error('Error in getAllOrders:', error);
    return errorResponse(res, 'Failed to retrieve orders', 500);
  }
};

/**
 * Update orderStatus through lifecycle: Order Received -> In Kitchen -> Sent to Delivery.
 * Does not alter paymentStatus or decrement inventory.
 * PATCH /api/admin/orders/:orderId/status
 * Request Body: { status: String } or { orderStatus: String }
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const status = req.body.status || req.body.orderStatus;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return errorResponse(res, 'Invalid order ID format', 400);
    }

    if (!status || typeof status !== 'string' || !VALID_ORDER_STATUSES.includes(status.trim())) {
      return errorResponse(
        res,
        `Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(', ')}`,
        400,
      );
    }

    const order = await Order.findById(orderId).select('-razorpaySignature');
    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    order.orderStatus = status.trim();
    order.updatedAt = new Date();
    await order.save();

    await order.populate('customer', 'name email');
    await order.populate('items.base');
    await order.populate('items.sauce');
    await order.populate('items.cheese');
    await order.populate('items.vegetables');

    return successResponse(
      res,
      {
        order,
      },
      200,
      `Order status updated to '${status.trim()}'`,
    );
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    return errorResponse(res, 'Failed to update order status', 500);
  }
};

module.exports = {
  getInventory,
  updateInventoryItem,
  getAllOrders,
  updateOrderStatus,
  VALID_ORDER_STATUSES,
};
