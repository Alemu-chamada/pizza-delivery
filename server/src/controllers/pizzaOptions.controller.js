const PizzaOption = require('../models/PizzaOption.model');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const VALID_CATEGORIES = ['base', 'sauce', 'cheese', 'vegetable'];

/**
 * Get all available pizza options across all categories.
 * GET /api/pizza-options
 */
const getAllOptions = async (req, res) => {
  const options = await PizzaOption.find({ isAvailable: true }).sort({ category: 1, name: 1 });

  const grouped = {
    base: options.filter((opt) => opt.category === 'base'),
    sauce: options.filter((opt) => opt.category === 'sauce'),
    cheese: options.filter((opt) => opt.category === 'cheese'),
    vegetable: options.filter((opt) => opt.category === 'vegetable'),
  };

  return successResponse(res, {
    options,
    grouped,
    counts: {
      base: grouped.base.length,
      sauce: grouped.sauce.length,
      cheese: grouped.cheese.length,
      vegetable: grouped.vegetable.length,
      total: options.length,
    },
  });
};

/**
 * Get available pizza options filtered by specific category.
 * GET /api/pizza-options/:category
 */
const getByCategory = async (req, res) => {
  const { category } = req.params;
  const normalizedCategory = category ? category.toLowerCase().trim() : '';

  if (!VALID_CATEGORIES.includes(normalizedCategory)) {
    return errorResponse(
      res,
      `Invalid category '${category}'. Valid categories are: ${VALID_CATEGORIES.join(', ')}`,
      400,
    );
  }

  const options = await PizzaOption.find({
    category: normalizedCategory,
    isAvailable: true,
  }).sort({ name: 1 });

  return successResponse(res, {
    category: normalizedCategory,
    count: options.length,
    options,
  });
};

module.exports = {
  getAllOptions,
  getByCategory,
  VALID_CATEGORIES,
};
