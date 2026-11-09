const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
  createOrder,
  verifyPayment,
  verifyPaymentByParam,
  handleChapaWebhook,
  getMyOrders,
  getOrderStatus,
} = require('../controllers/order.controller');

const router = express.Router();

/**
 * Order Routes
 * Customer-authenticated endpoints for ordering, payment verification, and tracking.
 * Public webhook endpoint for Chapa payment events.
 */

// POST /api/orders, /api/orders/create-order & /api/orders/create-chapa-order
router.post('/', requireAuth, asyncHandler(createOrder));
router.post('/create-order', requireAuth, asyncHandler(createOrder));
router.post('/create-chapa-order', requireAuth, asyncHandler(createOrder));

// POST /api/orders/verify-payment & GET /api/orders/verify/:txRef
router.post('/verify-payment', requireAuth, asyncHandler(verifyPayment));
router.get('/verify/:txRef', requireAuth, asyncHandler(verifyPaymentByParam));

// POST /api/orders/chapa/webhook & POST /api/orders/webhook (Server-to-server)
router.post('/chapa/webhook', asyncHandler(handleChapaWebhook));
router.post('/webhook', asyncHandler(handleChapaWebhook));

// GET /api/orders/my-orders
router.get('/my-orders', requireAuth, asyncHandler(getMyOrders));

// GET /api/orders/:orderId/status
router.get('/:orderId/status', requireAuth, asyncHandler(getOrderStatus));

module.exports = router;
