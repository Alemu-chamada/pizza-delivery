require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const PizzaOption = require('../models/PizzaOption.model');
const connectDB = require('../config/db');

/**
 * Seeds a verified demo customer and an initial paid order for browser/UI demonstration.
 * Plan Reference: project_plan.md §4.1 (FR-U16), §4.2 (FR-A07, FR-A08)
 */
const seedDemoOrder = async () => {
  try {
    await connectDB();

    // 1. Ensure verified demo customer exists
    const customerEmail = 'customer@pizzaapp.dev';
    let customer = await User.findOne({ email: customerEmail });
    if (!customer) {
      const passwordHash = await bcrypt.hash('Customer@123', 10);
      customer = await User.create({
        name: 'Alex Rivera',
        email: customerEmail,
        passwordHash,
        isVerified: true,
        role: 'customer',
      });
      console.log('Created verified demo customer: customer@pizzaapp.dev');
    } else {
      customer.isVerified = true;
      await customer.save();
    }

    // 2. Fetch pizza options
    const base = await PizzaOption.findOne({ category: 'base' });
    const sauce = await PizzaOption.findOne({ category: 'sauce' });
    const cheese = await PizzaOption.findOne({ category: 'cheese' });
    const veggies = await PizzaOption.find({ category: 'vegetable' }).limit(2);

    if (!base || !sauce || !cheese) {
      console.error('Pizza options must be seeded first. Run npm run seed:options');
      return;
    }

    // 3. Check if an active demo order already exists
    let existingOrder = await Order.findOne({ customer: customer._id });
    if (!existingOrder) {
      const totalPrice = (base.basePrice || 0)
        + (sauce.basePrice || 0)
        + (cheese.basePrice || 0)
        + veggies.reduce((acc, v) => acc + (v.basePrice || 0), 0);

      existingOrder = await Order.create({
        customer: customer._id,
        items: {
          base: base._id,
          sauce: sauce._id,
          cheese: cheese._id,
          vegetables: veggies.map((v) => v._id),
        },
        totalPrice,
        orderStatus: 'Order Received',
        paymentStatus: 'paid',
        razorpayOrderId: `order_demo_${Date.now()}`,
        razorpayPaymentId: `pay_demo_${Date.now()}`,
        razorpaySignature: 'sig_demo_placeholder_verified',
      });
      console.log('Created initial paid demo order with status "Order Received":', existingOrder._id.toString());
    } else {
      console.log('Demo order already exists for customer:', existingOrder._id.toString(), 'Current Status:', existingOrder.orderStatus);
    }
  } catch (error) {
    console.error('Error seeding demo order:', error);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  seedDemoOrder().then(() => process.exit(0));
}

module.exports = seedDemoOrder;
