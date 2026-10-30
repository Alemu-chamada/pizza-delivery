const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User.model');
const PizzaOption = require('../src/models/PizzaOption.model');
const Order = require('../src/models/Order.model');

describe('Phase 5 — Order Status Tracking & Customer History Tests', () => {
  let mongoServer;
  let customer1;
  let customer1Cookie;
  let customer2;
  let customer2Cookie;
  let baseOpt;
  let sauceOpt;
  let cheeseOpt;
  let vegOpt1;
  let vegOpt2;

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
    await PizzaOption.deleteMany({});
    await User.deleteMany({});

    // Create Customer 1
    customer1 = await User.create({
      name: 'Mario Rossi',
      email: 'mario.rossi@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      isVerified: true,
      role: 'customer',
    });

    const loginRes1 = await request(app)
      .post('/api/auth/login')
      .send({ email: customer1.email, password: 'password123' });
    customer1Cookie = loginRes1.headers['set-cookie'];

    // Create Customer 2
    customer2 = await User.create({
      name: 'Luigi Verde',
      email: 'luigi.verde@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      isVerified: true,
      role: 'customer',
    });

    const loginRes2 = await request(app)
      .post('/api/auth/login')
      .send({ email: customer2.email, password: 'password123' });
    customer2Cookie = loginRes2.headers['set-cookie'];

    // Pizza options
    baseOpt = await PizzaOption.create({
      category: 'base',
      name: 'Thin Crust',
      basePrice: 120,
      isAvailable: true,
    });

    sauceOpt = await PizzaOption.create({
      category: 'sauce',
      name: 'Classic Marinara',
      basePrice: 40,
      isAvailable: true,
    });

    cheeseOpt = await PizzaOption.create({
      category: 'cheese',
      name: 'Mozzarella',
      basePrice: 65,
      isAvailable: true,
    });

    vegOpt1 = await PizzaOption.create({
      category: 'vegetable',
      name: 'Bell Peppers',
      basePrice: 30,
      isAvailable: true,
    });

    vegOpt2 = await PizzaOption.create({
      category: 'vegetable',
      name: 'Black Olives',
      basePrice: 35,
      isAvailable: true,
    });
  });

  describe('1. Customer Order History (GET /api/orders/my-orders)', () => {
    it('rejects unauthenticated request to /api/orders/my-orders with HTTP 401', async () => {
      const res = await request(app).get('/api/orders/my-orders');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns empty array when authenticated customer has no orders', async () => {
      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Cookie', customer1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toEqual([]);
    });

    it('returns only customer 1 orders, strictly isolating customer 2 orders', async () => {
      // Create order for Customer 1
      await Order.create({
        customer: customer1._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 255,
        paymentStatus: 'paid',
        orderStatus: 'In Kitchen',
        razorpayOrderId: 'order_c1_001',
        razorpaySignature: 'sig_secret_123',
      });

      // Create order for Customer 2
      await Order.create({
        customer: customer2._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt2._id],
        },
        totalPrice: 260,
        paymentStatus: 'paid',
        orderStatus: 'Order Received',
        razorpayOrderId: 'order_c2_001',
        razorpaySignature: 'sig_secret_456',
      });

      // Customer 1 requests my-orders
      const res1 = await request(app)
        .get('/api/orders/my-orders')
        .set('Cookie', customer1Cookie);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.orders).toHaveLength(1);
      expect(res1.body.data.orders[0].razorpayOrderId).toBe('order_c1_001');
      expect(res1.body.data.orders[0].items.base.name).toBe('Thin Crust');
      expect(res1.body.data.orders[0].items.vegetables[0].name).toBe('Bell Peppers');

      // Customer 2 requests my-orders
      const res2 = await request(app)
        .get('/api/orders/my-orders')
        .set('Cookie', customer2Cookie);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.data.orders).toHaveLength(1);
      expect(res2.body.data.orders[0].razorpayOrderId).toBe('order_c2_001');
      expect(res2.body.data.orders[0].items.vegetables[0].name).toBe('Black Olives');
    });

    it('sorts orders newest first (descending by createdAt)', async () => {
      const olderOrder = await Order.create({
        customer: customer1._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        },
        totalPrice: 225,
        paymentStatus: 'paid',
        orderStatus: 'Sent to Delivery',
        razorpayOrderId: 'order_old_001',
        createdAt: new Date('2026-10-01T10:00:00Z'),
      });

      const newerOrder = await Order.create({
        customer: customer1._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 255,
        paymentStatus: 'paid',
        orderStatus: 'Order Received',
        razorpayOrderId: 'order_new_002',
        createdAt: new Date('2026-10-10T12:00:00Z'),
      });

      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Cookie', customer1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.orders).toHaveLength(2);
      expect(res.body.data.orders[0]._id).toBe(newerOrder._id.toString());
      expect(res.body.data.orders[1]._id).toBe(olderOrder._id.toString());
    });

    it('does NOT expose razorpaySignature or internal secrets in customer order history', async () => {
      await Order.create({
        customer: customer1._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        },
        totalPrice: 225,
        paymentStatus: 'paid',
        orderStatus: 'Order Received',
        razorpayOrderId: 'order_secret_test_1',
        razorpaySignature: 'super_sensitive_hmac_signature_hex_value',
      });

      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Cookie', customer1Cookie);

      expect(res.status).toBe(200);
      const order = res.body.data.orders[0];
      expect(order.razorpaySignature).toBeUndefined();
    });

    it('correctly includes and distinguishes paymentStatus (paid vs pending)', async () => {
      await Order.create({
        customer: customer1._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        },
        totalPrice: 225,
        paymentStatus: 'paid',
        orderStatus: 'In Kitchen',
        razorpayOrderId: 'order_paid_001',
      });

      await Order.create({
        customer: customer1._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        },
        totalPrice: 225,
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        razorpayOrderId: 'order_pending_002',
      });

      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Cookie', customer1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.orders).toHaveLength(2);
      const statuses = res.body.data.orders.map((o) => o.paymentStatus);
      expect(statuses).toContain('paid');
      expect(statuses).toContain('pending');
    });
  });

  describe('2. Individual Order Status Polling (GET /api/orders/:orderId/status)', () => {
    let paidOrder;

    beforeEach(async () => {
      paidOrder = await Order.create({
        customer: customer1._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 255,
        paymentStatus: 'paid',
        orderStatus: 'Order Received',
        razorpayOrderId: 'order_poll_test_001',
        razorpaySignature: 'secret_sig_do_not_leak',
      });
    });

    it('rejects unauthenticated request to /api/orders/:orderId/status with HTTP 401', async () => {
      const res = await request(app).get(`/api/orders/${paidOrder._id}/status`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid ObjectId format with HTTP 400', async () => {
      const res = await request(app)
        .get('/api/orders/not-a-valid-object-id/status')
        .set('Cookie', customer1Cookie);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid.*id/i);
    });

    it('rejects nonexistent order ID with HTTP 404', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/orders/${fakeId}/status`)
        .set('Cookie', customer1Cookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('rejects access when customer 2 attempts to inspect customer 1 order with HTTP 403', async () => {
      const res = await request(app)
        .get(`/api/orders/${paidOrder._id}/status`)
        .set('Cookie', customer2Cookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/unauthorized/i);
    });

    it('successfully returns orderStatus and populated details for owner', async () => {
      const res = await request(app)
        .get(`/api/orders/${paidOrder._id}/status`)
        .set('Cookie', customer1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe(paidOrder._id.toString());
      expect(res.body.data.orderStatus).toBe('Order Received');
      expect(res.body.data.paymentStatus).toBe('paid');
      expect(res.body.data.totalPrice).toBe(255);
      expect(res.body.data.items.base.name).toBe('Thin Crust');
      expect(res.body.data.items.sauce.name).toBe('Classic Marinara');
      expect(res.body.data.items.cheese.name).toBe('Mozzarella');
      expect(res.body.data.items.vegetables[0].name).toBe('Bell Peppers');
      expect(res.body.data.razorpaySignature).toBeUndefined();
    });

    it('accurately represents the entire 3-stage lifecycle: Order Received -> In Kitchen -> Sent to Delivery', async () => {
      // 1. Stage 1: Order Received
      let res = await request(app)
        .get(`/api/orders/${paidOrder._id}/status`)
        .set('Cookie', customer1Cookie);
      expect(res.body.data.orderStatus).toBe('Order Received');

      // 2. Stage 2: In Kitchen
      await Order.findByIdAndUpdate(paidOrder._id, { orderStatus: 'In Kitchen' });
      res = await request(app)
        .get(`/api/orders/${paidOrder._id}/status`)
        .set('Cookie', customer1Cookie);
      expect(res.body.data.orderStatus).toBe('In Kitchen');

      // 3. Stage 3: Sent to Delivery
      await Order.findByIdAndUpdate(paidOrder._id, { orderStatus: 'Sent to Delivery' });
      res = await request(app)
        .get(`/api/orders/${paidOrder._id}/status`)
        .set('Cookie', customer1Cookie);
      expect(res.body.data.orderStatus).toBe('Sent to Delivery');
    });

    it('guarantees customer cannot modify orderStatus via HTTP (no customer update endpoint)', async () => {
      // Attempt PUT, PATCH, POST to order status as customer
      const patchRes = await request(app)
        .patch(`/api/orders/${paidOrder._id}/status`)
        .set('Cookie', customer1Cookie)
        .send({ orderStatus: 'Sent to Delivery' });
      expect(patchRes.status).toBe(404); // Route not mounted on customer router

      const putRes = await request(app)
        .put(`/api/orders/${paidOrder._id}/status`)
        .set('Cookie', customer1Cookie)
        .send({ orderStatus: 'Sent to Delivery' });
      expect(putRes.status).toBe(404);
    });
  });
});
