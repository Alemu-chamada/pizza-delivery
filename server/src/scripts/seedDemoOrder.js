require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const PizzaOption = require('../models/PizzaOption.model');
const connectDB = require('../config/db');

/**
 * Seeds a verified demo customer for browser/UI testing.
 * Does NOT create a pre-paid order so as not to interfere with real Chapa payment testing.
 */
const seedDemoCustomer = async () => {
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
    console.log('[MongoDB] Created verified demo customer: customer@pizzaapp.dev');
  } else if (!customer.isVerified) {
    customer.isVerified = true;
    await customer.save();
  }
  return customer;
};

/**
 * Seeds an initial demo order. Only invoked when explicitly desired (e.g. standalone script).
 * Plan Reference: project_plan.md §4.1 (FR-U16), §4.2 (FR-A07, FR-A08)
 */
const seedDemoOrder = async () => {
  try {
    await connectDB();

    // 1. Ensure verified demo customer exists
    const customer = await seedDemoCustomer();

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
        currency: 'ETB',
        orderStatus: 'Order Received',
        paymentStatus: 'paid',
        paymentProvider: 'chapa',
        txRef: `tx-demo-${Date.now()}`,
        paymentReference: `chapa_ref_${Date.now()}`,
        paidAt: new Date(),
      });
      console.log('Created initial paid demo order with status "Order Received":', existingOrder._id.toString());
    } else {
      console.log('Demo order already exists for customer:', existingOrder._id.toString(), 'Current Status:', existingOrder.orderStatus);
    }
  } catch (error) {
    console.error('Error seeding demo order:', error);
  }
};

if (require.main === module) {
  seedDemoOrder()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = seedDemoOrder;
module.exports.seedDemoCustomer = seedDemoCustomer;
