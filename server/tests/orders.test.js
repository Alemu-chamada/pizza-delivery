const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User.model');
const PizzaOption = require('../src/models/PizzaOption.model');
const InventoryItem = require('../src/models/InventoryItem.model');
const Order = require('../src/models/Order.model');
const paymentService = require('../src/services/payment.service');
const EmailService = require('../src/services/email.service');

describe('Phase 4 — Pizza Builder, Order Flow, and Chapa Payment Tests', () => {
  let replSet;
  let customerCookie;
  let customerUser;
  let otherCustomerCookie;
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
    process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-mock_secret_key_for_testing_123';
    process.env.CHAPA_CALLBACK_URL = 'http://localhost:5001/api/orders/chapa/webhook';
    process.env.CHAPA_RETURN_URL = 'http://localhost:5173/payment';

    // In-memory replica set for transaction support
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const testUri = replSet.getUri();

    await mongoose.connect(testUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
    });

    const topologyType = mongoose.connection.client.topology.description.type;
    global.TRANSACTION_AVAILABLE = Boolean(topologyType && topologyType.includes('ReplicaSet'));
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (replSet) {
      await replSet.stop();
    }
  });

  beforeEach(async () => {
    await Order.deleteMany({});
    await InventoryItem.deleteMany({});
    await PizzaOption.deleteMany({});
    await User.deleteMany({});

    // Seed test customer
    const passwordHash = await bcrypt.hash('CustomerPass123!', 10);
    customerUser = await User.create({
      name: 'Mario Rossi',
      email: 'mario@customer.dev',
      passwordHash,
      role: 'customer',
      isVerified: true,
    });

    const otherUser = await User.create({
      name: 'Luigi Verde',
      email: 'luigi@customer.dev',
      passwordHash,
      role: 'customer',
      isVerified: true,
    });

    // Obtain JWT cookies
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mario@customer.dev', password: 'CustomerPass123!' });
    customerCookie = loginRes.headers['set-cookie'];

    const otherLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'luigi@customer.dev', password: 'CustomerPass123!' });
    otherCustomerCookie = otherLoginRes.headers['set-cookie'];

    // Seed 1 base, 1 sauce, 1 cheese, 2 vegetables in ETB
    baseOpt = await PizzaOption.create({
      category: 'base',
      name: 'Thin Crust',
      description: 'Crunchy traditional crust',
      basePrice: 120, // 120 ETB
      isAvailable: true,
    });
    await InventoryItem.create({
      linkedPizzaOption: baseOpt._id,
      name: baseOpt.name,
      category: baseOpt.category,
      currentStock: 50,
      lowStockThreshold: 20,
    });

    sauceOpt = await PizzaOption.create({
      category: 'sauce',
      name: 'Spicy Arrabiata',
      description: 'Fresh crushed tomatoes and chili',
      basePrice: 40, // 40 ETB
      isAvailable: true,
    });
    await InventoryItem.create({
      linkedPizzaOption: sauceOpt._id,
      name: sauceOpt.name,
      category: sauceOpt.category,
      currentStock: 50,
      lowStockThreshold: 20,
    });

    cheeseOpt = await PizzaOption.create({
      category: 'cheese',
      name: 'Fresh Mozzarella',
      description: 'Creamy high-moisture mozzarella',
      basePrice: 70, // 70 ETB
      isAvailable: true,
    });
    await InventoryItem.create({
      linkedPizzaOption: cheeseOpt._id,
      name: cheeseOpt.name,
      category: cheeseOpt.category,
      currentStock: 50,
      lowStockThreshold: 20,
    });

    vegOpt1 = await PizzaOption.create({
      category: 'vegetable',
      name: 'Button Mushrooms',
      description: 'Sliced button mushrooms',
      basePrice: 45, // 45 ETB
      isAvailable: true,
    });
    await InventoryItem.create({
      linkedPizzaOption: vegOpt1._id,
      name: vegOpt1.name,
      category: vegOpt1.category,
      currentStock: 50,
      lowStockThreshold: 20,
    });

    vegOpt2 = await PizzaOption.create({
      category: 'vegetable',
      name: 'Crisp Bell Peppers',
      description: 'Fresh red and green peppers',
      basePrice: 40, // 40 ETB
      isAvailable: true,
    });
    await InventoryItem.create({
      linkedPizzaOption: vegOpt2._id,
      name: vegOpt2.name,
      category: vegOpt2.category,
      currentStock: 50,
      lowStockThreshold: 20,
    });
  });

  describe('1. Pizza Configuration Validation & Options Checks', () => {
    it('rejects unauthenticated request to /create-order with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/orders/create-order')
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing required components with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/orders/create-order')
        .set('Cookie', customerCookie)
        .send({
          base: baseOpt._id,
          // Missing sauce and cheese
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Base, sauce, and cheese selections are required/i);
    });

    it('rejects invalid ObjectId strings with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/orders/create-order')
        .set('Cookie', customerCookie)
        .send({
          base: 'not_a_valid_id',
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid ID format/i);
    });

    it('accepts valid configuration with zero vegetables (empty array)', async () => {
      const initSpy = jest.spyOn(paymentService, 'initializeTransaction').mockResolvedValueOnce({
        checkoutUrl: 'https://checkout.chapa.co/checkout/payment/mock123',
        status: 'success',
      });

      const res = await request(app)
        .post('/api/orders/create-order')
        .set('Cookie', customerCookie)
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBeDefined();
      expect(res.body.data.txRef).toBeDefined();
      expect(res.body.data.currency).toBe('ETB');
      expect(res.body.data.checkoutUrl).toBe('https://checkout.chapa.co/checkout/payment/mock123');

      const savedOrder = await Order.findById(res.body.data.orderId);
      expect(savedOrder.items.vegetables).toHaveLength(0);
      expect(savedOrder.totalPrice).toBe(230); // 120 + 40 + 70 ETB
      expect(savedOrder.currency).toBe('ETB');
      initSpy.mockRestore();
    });

    it('deduplicates duplicate vegetable IDs to prevent double charging', async () => {
      const initSpy = jest.spyOn(paymentService, 'initializeTransaction').mockResolvedValueOnce({
        checkoutUrl: 'https://checkout.chapa.co/checkout/payment/mock_dedup',
        status: 'success',
      });

      const res = await request(app)
        .post('/api/orders/create-order')
        .set('Cookie', customerCookie)
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id, vegOpt1._id], // Duplicate IDs
        });

      expect(res.status).toBe(201);
      const savedOrder = await Order.findById(res.body.data.orderId);
      expect(savedOrder.items.vegetables).toHaveLength(1);
      expect(savedOrder.totalPrice).toBe(275); // 230 + 45 ETB
      initSpy.mockRestore();
    });
  });

  describe('2. Server-side Pricing Computation & Chapa Gateway Amount', () => {
    it('calculates totalPrice strictly from DB prices in ETB, ignoring client price', async () => {
      // 120 (base) + 40 (sauce) + 70 (cheese) + 45 (veg1) + 40 (veg2) = 315 ETB
      let sentAmount = 0;
      let sentCurrency = '';
      const initSpy = jest.spyOn(paymentService, 'initializeTransaction')
        .mockImplementationOnce(async ({ amount, currency }) => {
          sentAmount = amount;
          sentCurrency = currency;
          return {
            checkoutUrl: 'https://checkout.chapa.co/checkout/payment/mock_price_123',
            status: 'success',
          };
        });

      const res = await request(app)
        .post('/api/orders/create-order')
        .set('Cookie', customerCookie)
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id, vegOpt2._id],
          totalPrice: 1, // Tampered client price
          price: 50,
          amount: 100,
        });

      expect(res.status).toBe(201);
      expect(sentAmount).toBe(315);
      expect(sentCurrency).toBe('ETB');

      const savedOrder = await Order.findById(res.body.data.orderId);
      expect(savedOrder.totalPrice).toBe(315);
      expect(savedOrder.currency).toBe('ETB');
      initSpy.mockRestore();
    });

    it('returns HTTP 502 if Chapa gateway fails during transaction initialization', async () => {
      const initSpy = jest.spyOn(paymentService, 'initializeTransaction')
        .mockRejectedValueOnce(new Error('Gateway timeout'));

      const res = await request(app)
        .post('/api/orders/create-order')
        .set('Cookie', customerCookie)
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Chapa payment gateway/i);
      initSpy.mockRestore();
    });
  });

  describe('3. Inventory Pre-Check Before Order Creation', () => {
    it('returns HTTP 409 and creates no order if an ingredient is out of stock', async () => {
      await InventoryItem.findOneAndUpdate(
        { linkedPizzaOption: vegOpt2._id },
        { currentStock: 0 },
      );

      const res = await request(app)
        .post('/api/orders/create-order')
        .set('Cookie', customerCookie)
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id, vegOpt2._id],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Ingredient out of stock: Crisp Bell Peppers/i);

      // Verify no order was saved
      const orderCount = await Order.countDocuments();
      expect(orderCount).toBe(0);
    });
  });

  describe('4. Server-Side Payment Verification with Chapa', () => {
    let testOrder;
    const testTxRef = 'tx-pizza-test-flow-999';

    beforeEach(async () => {
      testOrder = await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275, // 275 ETB
        currency: 'ETB',
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        paymentProvider: 'chapa',
        txRef: testTxRef,
      });
    });

    it('rejects missing verification fields with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/txRef or orderId is required/i);
    });

    it('rejects non-existent transaction reference with HTTP 404', async () => {
      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef: 'tx-nonexistent-123' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Order not found/i);
    });

    it('rejects verification if order belongs to another customer with HTTP 403', async () => {
      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', otherCustomerCookie) // Other customer
        .send({ txRef: testTxRef });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Unauthorized/i);
    });

    it('rejects payment when Chapa reports failed transaction status', async () => {
      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValueOnce({
        status: 'failed',
        amount: 275,
        currency: 'ETB',
        reference: 'CHAPA_FAIL_REF',
        txRef: testTxRef,
      });

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef: testTxRef });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/status is failed/i);

      // Verify order marked failed
      const checkOrder = await Order.findById(testOrder._id);
      expect(checkOrder.paymentStatus).toBe('failed');

      // Verify stock was NOT decremented
      const baseInv = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseInv.currentStock).toBe(50);
      verifySpy.mockRestore();
    });

    it('rejects verification when Chapa reported amount does not match order total', async () => {
      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValueOnce({
        status: 'success',
        amount: 100, // Tampered: expected 275
        currency: 'ETB',
        reference: 'CHAPA_MISMATCH_REF',
        txRef: testTxRef,
      });

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef: testTxRef });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/amount mismatch/i);

      const checkOrder = await Order.findById(testOrder._id);
      expect(checkOrder.paymentStatus).toBe('failed');
      verifySpy.mockRestore();
    });

    it('rejects verification when Chapa reported currency does not match ETB', async () => {
      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValueOnce({
        status: 'success',
        amount: 275,
        currency: 'USD', // Mismatched currency
        reference: 'CHAPA_USD_REF',
        txRef: testTxRef,
      });

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef: testTxRef });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Currency mismatch/i);

      const checkOrder = await Order.findById(testOrder._id);
      expect(checkOrder.paymentStatus).toBe('failed');
      verifySpy.mockRestore();
    });

    it('successfully verifies valid Chapa payment and marks order paid with ETB currency', async () => {
      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValueOnce({
        status: 'success',
        amount: 275,
        currency: 'ETB',
        reference: 'CHAPA_VALID_REF_123',
        txRef: testTxRef,
      });

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef: testTxRef });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('paid');
      expect(res.body.data.currency).toBe('ETB');

      const confirmedOrder = await Order.findById(testOrder._id);
      expect(confirmedOrder.paymentStatus).toBe('paid');
      expect(confirmedOrder.paymentReference).toBe('CHAPA_VALID_REF_123');
      expect(confirmedOrder.paidAt).toBeDefined();

      verifySpy.mockRestore();
    });
  });

  describe('5. Inventory Decrement & Race Guard Verification', () => {
    it('decrements each required ingredient by exactly 1 upon successful payment', async () => {
      const txRef = 'tx-pizza-dec-check-111';
      await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id, vegOpt2._id],
        },
        totalPrice: 315,
        currency: 'ETB',
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        paymentProvider: 'chapa',
        txRef,
      });

      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValueOnce({
        status: 'success',
        amount: 315,
        currency: 'ETB',
        reference: 'CHAPA_REF_DEC',
        txRef,
      });

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef });

      expect(res.status).toBe(200);

      // Verify each selected ingredient decremented from 50 to 49
      const [baseInv, sauceInv, cheeseInv, veg1Inv, veg2Inv] = await Promise.all([
        InventoryItem.findOne({ linkedPizzaOption: baseOpt._id }),
        InventoryItem.findOne({ linkedPizzaOption: sauceOpt._id }),
        InventoryItem.findOne({ linkedPizzaOption: cheeseOpt._id }),
        InventoryItem.findOne({ linkedPizzaOption: vegOpt1._id }),
        InventoryItem.findOne({ linkedPizzaOption: vegOpt2._id }),
      ]);

      expect(baseInv.currentStock).toBe(49);
      expect(sauceInv.currentStock).toBe(49);
      expect(cheeseInv.currentStock).toBe(49);
      expect(veg1Inv.currentStock).toBe(49);
      expect(veg2Inv.currentStock).toBe(49);
      verifySpy.mockRestore();
    });

    it('guards against stock race condition: rejects verification if ingredient ran out during payment', async () => {
      const txRef = 'tx-pizza-race-guard-333';
      await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        currency: 'ETB',
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        paymentProvider: 'chapa',
        txRef,
      });

      // Stock drops to 0 before customer finishes paying
      await InventoryItem.findOneAndUpdate(
        { linkedPizzaOption: cheeseOpt._id },
        { currentStock: 0 },
      );

      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValueOnce({
        status: 'success',
        amount: 275,
        currency: 'ETB',
        reference: 'CHAPA_REF_RACE',
        txRef,
      });

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/out of stock during payment verification/i);

      // Order must be marked failed
      const checkOrder = await Order.findOne({ txRef });
      expect(checkOrder.paymentStatus).toBe('failed');
      verifySpy.mockRestore();
    });

    it('rolls back inventory decrements if database transaction aborts during payment confirmation', async () => {
      const txRef = 'tx-pizza-tx-abort-555';
      const orderDoc = await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        currency: 'ETB',
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        paymentProvider: 'chapa',
        txRef,
      });

      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValue({
        status: 'success',
        amount: 275,
        currency: 'ETB',
        reference: 'CHAPA_REF_ABORT',
        txRef,
      });

      // Force an error during order.save inside transaction
      const saveSpy = jest.spyOn(Order.prototype, 'save')
        .mockRejectedValueOnce(new Error('Simulated DB failure during transaction'));

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef });

      expect(res.status).toBe(500);

      // Stock must remain unchanged at 50
      const baseInv = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseInv.currentStock).toBe(50);

      const checkOrder = await Order.findById(orderDoc._id);
      expect(checkOrder.paymentStatus).toBe('pending');

      saveSpy.mockRestore();
      verifySpy.mockRestore();
    });
  });

  describe('6. Idempotency Protections on Payment Verification & Webhooks', () => {
    it('returns HTTP 200 with alreadyConfirmed: true on duplicate verification without re-decrementing stock', async () => {
      const txRef = 'tx-pizza-idempotent-444';
      await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        currency: 'ETB',
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        paymentProvider: 'chapa',
        txRef,
      });

      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValue({
        status: 'success',
        amount: 275,
        currency: 'ETB',
        reference: 'CHAPA_REF_IDEM',
        txRef,
      });

      // First verification call
      const res1 = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef });

      expect(res1.status).toBe(200);
      expect(res1.body.data.paymentStatus).toBe('paid');

      // Check stock after first decrement: 50 -> 49
      const baseAfterFirst = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseAfterFirst.currentStock).toBe(49);

      // Second (duplicate) verification call
      const res2 = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef });

      expect(res2.status).toBe(200);
      expect(res2.body.data.alreadyConfirmed).toBe(true);

      // Crucial: stock MUST still be 49 (no second decrement!)
      const baseAfterSecond = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseAfterSecond.currentStock).toBe(49);
      verifySpy.mockRestore();
    });

    it('processes Chapa server webhook idempotently without double-decrementing stock', async () => {
      const txRef = 'tx-pizza-webhook-666';
      await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        },
        totalPrice: 230,
        currency: 'ETB',
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        paymentProvider: 'chapa',
        txRef,
      });

      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValue({
        status: 'success',
        amount: 230,
        currency: 'ETB',
        reference: 'CHAPA_WEBHOOK_REF_666',
        txRef,
      });

      // 1. Initial webhook delivery
      const whRes1 = await request(app)
        .post('/api/orders/chapa/webhook')
        .send({ tx_ref: txRef, status: 'success' });

      expect(whRes1.status).toBe(200);
      expect(whRes1.body.status).toBe('success');

      const cheeseInvAfterFirst = await InventoryItem.findOne({
        linkedPizzaOption: cheeseOpt._id,
      });
      expect(cheeseInvAfterFirst.currentStock).toBe(49);

      // 2. Replayed duplicate webhook delivery
      const whRes2 = await request(app)
        .post('/api/orders/chapa/webhook')
        .send({ tx_ref: txRef, status: 'success' });

      expect(whRes2.status).toBe(200);
      expect(whRes2.body.status).toBe('already_paid');

      // Crucial: stock still 49
      const cheeseInvAfterSecond = await InventoryItem.findOne({
        linkedPizzaOption: cheeseOpt._id,
      });
      expect(cheeseInvAfterSecond.currentStock).toBe(49);
      verifySpy.mockRestore();
    });
  });

  describe('7. Order Retrieval & Status Polling APIs in ETB', () => {
    let paidOrder;

    beforeEach(async () => {
      paidOrder = await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        currency: 'ETB',
        paymentStatus: 'paid',
        orderStatus: 'In Kitchen',
        paymentProvider: 'chapa',
        txRef: 'tx-pizza-status-poll-555',
        paymentReference: 'CHAPA_REF_POLL',
        paidAt: new Date(),
      });
    });

    it('returns customer orders with ETB currency on GET /api/orders/my-orders', async () => {
      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toHaveLength(1);
      expect(res.body.data.orders[0]._id).toBe(paidOrder._id.toString());
      expect(res.body.data.orders[0].currency).toBe('ETB');
      expect(res.body.data.orders[0].items.base.name).toBe('Thin Crust');
    });

    it('returns orderStatus and ETB total on GET /api/orders/:orderId/status for owner', async () => {
      const res = await request(app)
        .get(`/api/orders/${paidOrder._id}/status`)
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderStatus).toBe('In Kitchen');
      expect(res.body.data.paymentStatus).toBe('paid');
      expect(res.body.data.currency).toBe('ETB');
      expect(res.body.data.totalPrice).toBe(275);
    });

    it('rejects status polling for other customer orders with HTTP 403', async () => {
      const res = await request(app)
        .get(`/api/orders/${paidOrder._id}/status`)
        .set('Cookie', otherCustomerCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects status polling for nonexistent order ID with HTTP 404', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/orders/${fakeId}/status`)
        .set('Cookie', customerCookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('8. Transaction-Unavailable Sequenced Fallback Path', () => {
    let originalTxAvailable;

    beforeEach(() => {
      originalTxAvailable = global.TRANSACTION_AVAILABLE;
      global.TRANSACTION_AVAILABLE = false;
    });

    afterEach(() => {
      global.TRANSACTION_AVAILABLE = originalTxAvailable;
    });

    it('successfully confirms payment and decrements inventory through sequenced fallback path', async () => {
      const txRef = 'tx-pizza-fallback-success-777';
      const order = await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        currency: 'ETB',
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        paymentProvider: 'chapa',
        txRef,
      });

      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValueOnce({
        status: 'success',
        amount: 275,
        currency: 'ETB',
        reference: 'CHAPA_FB_REF_777',
        txRef,
      });

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('paid');

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.paymentStatus).toBe('paid');

      const [baseInv, sauceInv, cheeseInv, veg1Inv] = await Promise.all([
        InventoryItem.findOne({ linkedPizzaOption: baseOpt._id }),
        InventoryItem.findOne({ linkedPizzaOption: sauceOpt._id }),
        InventoryItem.findOne({ linkedPizzaOption: cheeseOpt._id }),
        InventoryItem.findOne({ linkedPizzaOption: vegOpt1._id }),
      ]);

      expect(baseInv.currentStock).toBe(49);
      expect(sauceInv.currentStock).toBe(49);
      expect(cheeseInv.currentStock).toBe(49);
      expect(veg1Inv.currentStock).toBe(49);
      verifySpy.mockRestore();
    });

    it('handles duplicate verification idempotently in fallback mode without re-decrementing stock', async () => {
      const txRef = 'tx-pizza-fallback-idem-888';
      await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        currency: 'ETB',
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        paymentProvider: 'chapa',
        txRef,
      });

      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValue({
        status: 'success',
        amount: 275,
        currency: 'ETB',
        reference: 'CHAPA_FB_IDEM_888',
        txRef,
      });

      // First verification in fallback mode
      const res1 = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef });

      expect(res1.status).toBe(200);

      const baseInvAfterFirst = await InventoryItem.findOne({
        linkedPizzaOption: baseOpt._id,
      });
      expect(baseInvAfterFirst.currentStock).toBe(49);

      // Second verification in fallback mode
      const res2 = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef });

      expect(res2.status).toBe(200);
      expect(res2.body.data.alreadyConfirmed).toBe(true);

      const baseInvAfterSecond = await InventoryItem.findOne({
        linkedPizzaOption: baseOpt._id,
      });
      expect(baseInvAfterSecond.currentStock).toBe(49);
      verifySpy.mockRestore();
    });

    it('handles inventory write failure during fallback (order confirmed, compensating log + admin email alert)', async () => {
      const txRef = 'tx-pizza-fallback-partial-fail-999';
      const order = await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        currency: 'ETB',
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        paymentProvider: 'chapa',
        txRef,
      });

      const verifySpy = jest.spyOn(paymentService, 'verifyTransaction').mockResolvedValue({
        status: 'success',
        amount: 275,
        currency: 'ETB',
        reference: 'CHAPA_PARTIAL_FAIL_REF',
        txRef,
      });

      const emailSpy = jest.spyOn(EmailService, 'sendInventoryFailureAlert').mockResolvedValue({});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const origFindOneAndUpdate = InventoryItem.findOneAndUpdate.bind(InventoryItem);
      const invSpy = jest.spyOn(InventoryItem, 'findOneAndUpdate').mockImplementation((filter, ...args) => {
        if (
          filter
          && filter.linkedPizzaOption
          && filter.linkedPizzaOption.toString() === vegOpt1._id.toString()
          && filter.currentStock
        ) {
          return Promise.resolve(null);
        }
        return origFindOneAndUpdate(filter, ...args);
      });

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({ txRef });

      invSpy.mockRestore();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('paid');

      const savedOrder = await Order.findById(order._id);
      expect(savedOrder.paymentStatus).toBe('paid');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[COMPENSATING FALLBACK]'),
      );

      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: order._id,
          optionId: vegOpt1._id,
        }),
      );

      const baseInv = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseInv.currentStock).toBe(49);

      emailSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      verifySpy.mockRestore();
    });
  });
});
