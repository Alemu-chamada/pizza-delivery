const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User.model');
const Admin = require('../src/models/Admin.model');
const PizzaOption = require('../src/models/PizzaOption.model');
const InventoryItem = require('../src/models/InventoryItem.model');
const Order = require('../src/models/Order.model');

describe('Phase 6 — Admin Panel Integration Tests', () => {
  let mongoServer;
  let adminUser;
  let adminCookie;
  let customerUser;
  let customerCookie;

  let baseOption;
  let sauceOption;
  let cheeseOption;
  let vegOption;

  let baseInventory;
  let sauceInventory;
  let sampleOrder;

  beforeAll(async () => {
    require('dotenv').config();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_super_secret_key_at_least_64_characters_long_for_hs256_signing';
    process.env.JWT_EXPIRY = '7d';

    mongoServer = await MongoMemoryServer.create();
    const testUri = mongoServer.getUri();

    await mongoose.connect(testUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
    });
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Order.deleteMany({});
    await InventoryItem.deleteMany({});
    await PizzaOption.deleteMany({});
    await User.deleteMany({});
    await Admin.deleteMany({});

    // Seed Admin
    adminUser = await Admin.create({
      name: 'Super Admin',
      email: 'admin@pizzaapp.dev',
      passwordHash: await bcrypt.hash('AdminSecret123', 10),
      role: 'admin',
    });

    const adminLoginRes = await request(app)
      .post('/api/auth/admin-login')
      .send({ email: 'admin@pizzaapp.dev', password: 'AdminSecret123' });
    adminCookie = adminLoginRes.headers['set-cookie'];

    // Seed Customer
    customerUser = await User.create({
      name: 'Regular Customer',
      email: 'customer@example.com',
      passwordHash: await bcrypt.hash('CustomerSecret123', 10),
      isVerified: true,
      role: 'customer',
    });

    const customerLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.com', password: 'CustomerSecret123' });
    customerCookie = customerLoginRes.headers['set-cookie'];

    // Seed Pizza Options
    baseOption = await PizzaOption.create({
      name: 'Thin Crust',
      category: 'base',
      basePrice: 150,
      isAvailable: true,
    });

    sauceOption = await PizzaOption.create({
      name: 'Marinara',
      category: 'sauce',
      basePrice: 50,
      isAvailable: true,
    });

    cheeseOption = await PizzaOption.create({
      name: 'Mozzarella',
      category: 'cheese',
      basePrice: 80,
      isAvailable: true,
    });

    vegOption = await PizzaOption.create({
      name: 'Black Olives',
      category: 'vegetable',
      basePrice: 40,
      isAvailable: true,
    });

    // Seed Inventory Items
    baseInventory = await InventoryItem.create({
      name: 'Thin Crust Dough',
      category: 'base',
      currentStock: 45,
      lowStockThreshold: 20,
      unit: 'dough balls',
      linkedPizzaOption: baseOption._id,
    });

    sauceInventory = await InventoryItem.create({
      name: 'Marinara Sauce Pot',
      category: 'sauce',
      currentStock: 15, // Below threshold 20 -> isLowStock = true
      lowStockThreshold: 20,
      unit: 'servings',
      linkedPizzaOption: sauceOption._id,
    });

    // Seed Sample Customer Order
    sampleOrder = await Order.create({
      customer: customerUser._id,
      items: {
        base: baseOption._id,
        sauce: sauceOption._id,
        cheese: cheeseOption._id,
        vegetables: [vegOption._id],
      },
      totalPrice: 320,
      orderStatus: 'Order Received',
      paymentStatus: 'paid',
      razorpayOrderId: 'order_test_admin_001',
      razorpayPaymentId: 'pay_test_admin_001',
      razorpaySignature: 'sensitive_sig_must_be_excluded',
    });
  });

  describe('1. Role Authorization and Admin Access Guards', () => {
    it('rejects unauthenticated requests to GET /api/admin/inventory with 401', async () => {
      const res = await request(app).get('/api/admin/inventory');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects customer JWT on GET /api/admin/inventory with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/inventory')
        .set('Cookie', customerCookie);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Requires admin role/i);
    });

    it('rejects customer JWT on PATCH /api/admin/inventory/:itemId with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/admin/inventory/${baseInventory._id}`)
        .set('Cookie', customerCookie)
        .send({ currentStock: 99 });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects customer JWT on GET /api/admin/orders with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Cookie', customerCookie);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects customer JWT on PATCH /api/admin/orders/:orderId/status with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${sampleOrder._id}/status`)
        .set('Cookie', customerCookie)
        .send({ status: 'In Kitchen' });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('permits authenticated admin with valid admin cookie on GET /api/admin/inventory', async () => {
      const res = await request(app)
        .get('/api/admin/inventory')
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. Inventory Management Endpoints', () => {
    it('returns all inventory items with populated linked pizza options and low-stock indicators', async () => {
      const res = await request(app)
        .get('/api/admin/inventory')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inventory).toHaveLength(2);

      const thinCrust = res.body.data.inventory.find((i) => i.name === 'Thin Crust Dough');
      expect(thinCrust).toBeDefined();
      expect(thinCrust.currentStock).toBe(45);
      expect(thinCrust.isLowStock).toBe(false);
      expect(thinCrust.linkedPizzaOption).toBeDefined();
      expect(thinCrust.linkedPizzaOption.name).toBe('Thin Crust');

      const marinara = res.body.data.inventory.find((i) => i.name === 'Marinara Sauce Pot');
      expect(marinara).toBeDefined();
      expect(marinara.currentStock).toBe(15);
      expect(marinara.isLowStock).toBe(true); // 15 < 20
      expect(res.body.data.lowStockCount).toBe(1);
    });

    it('updates currentStock successfully for valid non-negative integer', async () => {
      const res = await request(app)
        .patch(`/api/admin/inventory/${baseInventory._id}`)
        .set('Cookie', adminCookie)
        .send({ currentStock: 75 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.item.currentStock).toBe(75);
      expect(res.body.data.item.isLowStock).toBe(false);

      const dbItem = await InventoryItem.findById(baseInventory._id);
      expect(dbItem.currentStock).toBe(75);
    });

    it('updates low-stock indicator dynamically when stock is decreased below threshold', async () => {
      const res = await request(app)
        .patch(`/api/admin/inventory/${baseInventory._id}`)
        .set('Cookie', adminCookie)
        .send({ currentStock: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.item.currentStock).toBe(10);
      expect(res.body.data.item.isLowStock).toBe(true);
    });

    it('rejects negative currentStock values with 400 Bad Request', async () => {
      const res = await request(app)
        .patch(`/api/admin/inventory/${baseInventory._id}`)
        .set('Cookie', adminCookie)
        .send({ currentStock: -10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/non-negative/i);

      // Verify stock was NOT modified
      const dbItem = await InventoryItem.findById(baseInventory._id);
      expect(dbItem.currentStock).toBe(45);
    });

    it('rejects non-numeric or missing currentStock with 400 Bad Request', async () => {
      const res1 = await request(app)
        .patch(`/api/admin/inventory/${baseInventory._id}`)
        .set('Cookie', adminCookie)
        .send({ currentStock: 'invalid_stock' });

      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .patch(`/api/admin/inventory/${baseInventory._id}`)
        .set('Cookie', adminCookie)
        .send({});

      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
    });

    it('returns 400 for invalid ObjectId format in inventory itemId', async () => {
      const res = await request(app)
        .patch('/api/admin/inventory/not-a-valid-id')
        .set('Cookie', adminCookie)
        .send({ currentStock: 10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid inventory item ID format/i);
    });

    it('returns 404 for non-existent inventory item', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/admin/inventory/${nonExistentId}`)
        .set('Cookie', adminCookie)
        .send({ currentStock: 25 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe('3. Order Management Endpoints', () => {
    it('returns all orders sorted newest first with populated customer and items, excluding razorpaySignature', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toHaveLength(1);

      const order = res.body.data.orders[0];
      expect(order._id.toString()).toBe(sampleOrder._id.toString());
      expect(order.razorpaySignature).toBeUndefined();
      expect(order.customer).toBeDefined();
      expect(order.customer.name).toBe('Regular Customer');
      expect(order.customer.email).toBe('customer@example.com');
      expect(order.items.base.name).toBe('Thin Crust');
      expect(order.items.sauce.name).toBe('Marinara');
      expect(order.items.cheese.name).toBe('Mozzarella');
      expect(order.items.vegetables[0].name).toBe('Black Olives');
    });

    it('updates order status to "In Kitchen"', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${sampleOrder._id}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'In Kitchen' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.orderStatus).toBe('In Kitchen');

      const dbOrder = await Order.findById(sampleOrder._id);
      expect(dbOrder.orderStatus).toBe('In Kitchen');
      expect(dbOrder.paymentStatus).toBe('paid');
      expect(dbOrder.totalPrice).toBe(320);
    });

    it('updates order status to "Sent to Delivery"', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${sampleOrder._id}/status`)
        .set('Cookie', adminCookie)
        .send({ orderStatus: 'Sent to Delivery' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.orderStatus).toBe('Sent to Delivery');

      const dbOrder = await Order.findById(sampleOrder._id);
      expect(dbOrder.orderStatus).toBe('Sent to Delivery');
    });

    it('rejects invalid order status values with 400 Bad Request', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${sampleOrder._id}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'Delivered' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Must be one of: Order Received, In Kitchen, Sent to Delivery/i);

      // Verify status was not modified
      const dbOrder = await Order.findById(sampleOrder._id);
      expect(dbOrder.orderStatus).toBe('Order Received');
    });

    it('rejects missing status payload with 400 Bad Request', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${sampleOrder._id}/status`)
        .set('Cookie', adminCookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid orderId ObjectId format', async () => {
      const res = await request(app)
        .patch('/api/admin/orders/not-a-valid-id/status')
        .set('Cookie', adminCookie)
        .send({ status: 'In Kitchen' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid order ID format/i);
    });

    it('returns 404 for non-existent order ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/admin/orders/${nonExistentId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'In Kitchen' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Order not found/i);
    });
  });

  describe('4. Integration Propagation to Customer Polling Endpoint', () => {
    it('immediately reflects admin status updates on customer polling endpoint GET /api/orders/:orderId/status', async () => {
      // Step 1: Customer polls and sees 'Order Received'
      const initialPoll = await request(app)
        .get(`/api/orders/${sampleOrder._id}/status`)
        .set('Cookie', customerCookie);
      expect(initialPoll.status).toBe(200);
      expect(initialPoll.body.data.orderStatus).toBe('Order Received');

      // Step 2: Admin transitions order to 'In Kitchen'
      const adminUpdate1 = await request(app)
        .patch(`/api/admin/orders/${sampleOrder._id}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'In Kitchen' });
      expect(adminUpdate1.status).toBe(200);

      // Step 3: Customer polls again and immediately observes 'In Kitchen'
      const kitchenPoll = await request(app)
        .get(`/api/orders/${sampleOrder._id}/status`)
        .set('Cookie', customerCookie);
      expect(kitchenPoll.status).toBe(200);
      expect(kitchenPoll.body.data.orderStatus).toBe('In Kitchen');

      // Step 4: Admin transitions order to 'Sent to Delivery'
      const adminUpdate2 = await request(app)
        .patch(`/api/admin/orders/${sampleOrder._id}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'Sent to Delivery' });
      expect(adminUpdate2.status).toBe(200);

      // Step 5: Customer polls and observes terminal status 'Sent to Delivery'
      const deliveryPoll = await request(app)
        .get(`/api/orders/${sampleOrder._id}/status`)
        .set('Cookie', customerCookie);
      expect(deliveryPoll.status).toBe(200);
      expect(deliveryPoll.body.data.orderStatus).toBe('Sent to Delivery');
    });
  });
});
