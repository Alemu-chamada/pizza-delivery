const mongoose = require('mongoose');

/**
 * InventoryItem Mongoose Schema
 * Tracks ingredient inventory levels linked 1-to-1 with a PizzaOption.
 */
const inventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Inventory item name is required'],
    trim: true,
  },
  category: {
    type: String,
    enum: ['base', 'sauce', 'cheese', 'vegetable'],
    required: [true, 'Category is required'],
  },
  currentStock: {
    type: Number,
    required: [true, 'Current stock is required'],
    min: [0, 'Stock cannot be negative'],
  },
  lowStockThreshold: {
    type: Number,
    default: 20,
    min: [0, 'Low stock threshold cannot be negative'],
  },
  unit: {
    type: String,
    default: 'units',
    trim: true,
  },
  linkedPizzaOption: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PizzaOption',
    required: [true, 'Linked pizza option is required'],
    unique: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);

module.exports = InventoryItem;
