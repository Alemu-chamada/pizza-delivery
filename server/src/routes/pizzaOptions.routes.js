const express = require('express');
const pizzaOptionsController = require('../controllers/pizzaOptions.controller');
const requireAuth = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All pizza-options routes require customer authentication cookie per project_plan §10.2
router.use(requireAuth);

// GET /api/pizza-options - Get all available options grouped
router.get('/', asyncHandler(pizzaOptionsController.getAllOptions));

// GET /api/pizza-options/:category - Get options filtered by category
router.get('/:category', asyncHandler(pizzaOptionsController.getByCategory));

module.exports = router;
