const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
  createRazorpayOrder,
  verifyPayment,
  getMyOrders,
  getOrderStatus,
} = require('../controllers/order.controller');

const router = express.Router();

/**
 * Order Routes
 * All routes require authenticated customer (httpOnly cookie).
 * Plan Reference: project_plan.md §10.3
 */

// POST /api/orders/create-razorpay-order
router.post('/create-razorpay-order', requireAuth, asyncHandler(createRazorpayOrder));

// POST /api/orders/verify-payment
router.post('/verify-payment', requireAuth, asyncHandler(verifyPayment));

// GET /api/orders/my-orders
router.get('/my-orders', requireAuth, asyncHandler(getMyOrders));

// GET /api/orders/:orderId/status
router.get('/:orderId/status', requireAuth, asyncHandler(getOrderStatus));

module.exports = router;
