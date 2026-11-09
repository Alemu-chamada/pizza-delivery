const mongoose = require('mongoose');

/**
 * Order Mongoose Schema
 * Stores customer pizza orders, server-computed pricing in ETB,
 * payment provider identifiers (Chapa), payment status, and order lifecycle states.
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
    ],
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0, 'Total price cannot be negative'],
  },
  currency: {
    type: String,
    default: 'ETB',
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
  paymentProvider: {
    type: String,
    enum: ['chapa', 'razorpay'],
    default: 'chapa',
  },
  txRef: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  paymentReference: {
    type: String,
    default: null,
  },
  paidAt: {
    type: Date,
    default: null,
  },
  // Backward compatibility fields for legacy records
  razorpayOrderId: {
    type: String,
    sparse: true,
    default: null,
  },
  razorpayPaymentId: {
    type: String,
    default: null,
  },
  razorpaySignature: {
    type: String,
    default: null,
    select: false,
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
