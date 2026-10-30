const mongoose = require('mongoose');

/**
 * Order Mongoose Schema
 * Stores customer pizza orders, server-computed pricing,
 * Razorpay identifiers, payment status, and order lifecycle states.
 * Plan Reference: project_plan.md §9.6
 */
const orderSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer ID is required'],
    index: true,
  },
  items: {
    base: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PizzaOption',
      required: [true, 'Base option is required'],
    },
    sauce: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PizzaOption',
      required: [true, 'Sauce option is required'],
    },
    cheese: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PizzaOption',
      required: [true, 'Cheese option is required'],
    },
    vegetables: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PizzaOption',
      },
    ], // Empty array is valid per §9.6 and §18 Decision 8
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0, 'Total price cannot be negative'],
  },
  orderStatus: {
    type: String,
    enum: ['Order Received', 'In Kitchen', 'Sent to Delivery'],
    default: 'Order Received',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  razorpayOrderId: {
    type: String,
    required: [true, 'Razorpay order ID is required'],
    unique: true, // Prevents duplicate confirmed orders
  },
  razorpayPaymentId: {
    type: String,
    default: null,
  },
  razorpaySignature: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
