const mongoose = require('mongoose');

/**
 * PizzaOption Mongoose Schema
 * Represents selectable pizza components (base, sauce, cheese, vegetable).
 */
const pizzaOptionSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['base', 'sauce', 'cheese', 'vegetable'],
    required: [true, 'Category is required'],
  },
  name: {
    type: String,
    required: [true, 'Option name is required'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  basePrice: {
    type: Number,
    default: 0,
    min: [0, 'Base price cannot be negative'],
  },
  imageUrl: {
    type: String,
    default: '',
    trim: true,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
});

// Compound unique index ensuring no duplicate names within the same category
pizzaOptionSchema.index({ category: 1, name: 1 }, { unique: true });

const PizzaOption = mongoose.model('PizzaOption', pizzaOptionSchema);

module.exports = PizzaOption;
