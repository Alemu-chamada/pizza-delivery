const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');
const {
  getInventory,
  updateInventoryItem,
  getAllOrders,
  updateOrderStatus,
} = require('../controllers/admin.controller');

const router = express.Router();

/**
 * All admin routes require authentication and an active admin role.
 * Customer JWTs and unauthenticated requests are strictly rejected.
 * Plan Reference: project_plan.md §4.2, §10.4 (FR-A02)
 */
router.use(requireAuth, requireAdmin);

// Inventory routes
router.get('/inventory', getInventory);
router.patch('/inventory/:itemId', updateInventoryItem);

// Order management routes
router.get('/orders', getAllOrders);
router.patch('/orders/:orderId/status', updateOrderStatus);

module.exports = router;
