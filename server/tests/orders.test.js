const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User.model');
const PizzaOption = require('../src/models/PizzaOption.model');
const InventoryItem = require('../src/models/InventoryItem.model');
const Order = require('../src/models/Order.model');
const paymentService = require('../src/services/payment.service');
const EmailService = require('../src/services/email.service');

describe('Phase 4 — Pizza Builder, Order Flow, and Payment Tests', () => {
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
    process.env.RAZORPAY_KEY_ID = 'rzp_test_mock_key_123';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret_for_razorpay_hmac_verification_123';

    // In-memory replica set per project_plan.md §16.1 for transaction support
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

    // 1. Create main customer and obtain auth cookie
    customerUser = await User.create({
      name: 'Mario Customer',
      email: 'mario@example.com',
      passwordHash: await bcrypt.hash('marioPass123', 10),
      isVerified: true,
      role: 'customer',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: customerUser.email, password: 'marioPass123' });
    customerCookie = loginRes.headers['set-cookie'];

    // 2. Create second customer for ownership tests
    const otherUser = await User.create({
      name: 'Luigi Customer',
      email: 'luigi@example.com',
      passwordHash: await bcrypt.hash('luigiPass123', 10),
      isVerified: true,
      role: 'customer',
    });

    const otherLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: otherUser.email, password: 'luigiPass123' });
    otherCustomerCookie = otherLoginRes.headers['set-cookie'];

    // 3. Create PizzaOption records
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
      basePrice: 70,
      isAvailable: true,
    });

    vegOpt1 = await PizzaOption.create({
      category: 'vegetable',
      name: 'Fresh Mushrooms',
      basePrice: 45,
      isAvailable: true,
    });

    vegOpt2 = await PizzaOption.create({
      category: 'vegetable',
      name: 'Crisp Bell Peppers',
      basePrice: 40,
      isAvailable: true,
    });

    // 4. Create matching InventoryItem records with stock 50
    await InventoryItem.create([
      {
        name: baseOpt.name,
        category: 'base',
        currentStock: 50,
        linkedPizzaOption: baseOpt._id,
      },
      {
        name: sauceOpt.name,
        category: 'sauce',
        currentStock: 50,
        linkedPizzaOption: sauceOpt._id,
      },
      {
        name: cheeseOpt.name,
        category: 'cheese',
        currentStock: 50,
        linkedPizzaOption: cheeseOpt._id,
      },
      {
        name: vegOpt1.name,
        category: 'vegetable',
        currentStock: 50,
        linkedPizzaOption: vegOpt1._id,
      },
      {
        name: vegOpt2.name,
        category: 'vegetable',
        currentStock: 50,
        linkedPizzaOption: vegOpt2._id,
      },
    ]);
  });

  // Helper to generate real HMAC signature
  const generateValidSignature = (orderId, paymentId) => crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  describe('1. Pizza Configuration Validation & Options Checks', () => {
    it('rejects unauthenticated request to create order with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/orders/create-razorpay-order')
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing base, sauce, or cheese with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/orders/create-razorpay-order')
        .set('Cookie', customerCookie)
        .send({
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Base, sauce, and cheese selections are required/i);
    });

    it('rejects invalid ObjectId string with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/orders/create-razorpay-order')
        .set('Cookie', customerCookie)
        .send({
          base: 'not-a-valid-object-id',
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid ID format/i);
    });

    it('rejects category mismatch (e.g., sauce ID passed as base) with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/orders/create-razorpay-order')
        .set('Cookie', customerCookie)
        .send({
          base: sauceOpt._id, // Wrong category!
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not a valid base/i);
    });

    it('rejects unavailable option (isAvailable: false) with HTTP 400', async () => {
      await PizzaOption.findByIdAndUpdate(cheeseOpt._id, { isAvailable: false });

      const res = await request(app)
        .post('/api/orders/create-razorpay-order')
        .set('Cookie', customerCookie)
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not available/i);
    });

    it('accepts valid configuration with zero vegetables (empty array)', async () => {
      const createOrderSpy = jest.spyOn(paymentService, 'createRazorpayOrder').mockResolvedValueOnce({
        id: 'order_rzp_mock_empty_veg_123',
        amount: 23000, // 120 + 40 + 70 = 230 rupees = 23000 paise
        currency: 'INR',
      });

      const res = await request(app)
        .post('/api/orders/create-razorpay-order')
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
      expect(res.body.data.razorpayOrderId).toBe('order_rzp_mock_empty_veg_123');

      const savedOrder = await Order.findById(res.body.data.orderId);
      expect(savedOrder.items.vegetables).toHaveLength(0);
      expect(savedOrder.totalPrice).toBe(230);
      createOrderSpy.mockRestore();
    });

    it('deduplicates duplicate vegetable IDs to prevent double charging', async () => {
      const createOrderSpy = jest.spyOn(paymentService, 'createRazorpayOrder').mockResolvedValueOnce({
        id: 'order_rzp_mock_dedup_123',
        amount: 27500, // 120 + 40 + 70 + 45 (single vegOpt1) = 275 rupees
        currency: 'INR',
      });

      const res = await request(app)
        .post('/api/orders/create-razorpay-order')
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
      expect(savedOrder.totalPrice).toBe(275);
      createOrderSpy.mockRestore();
    });
  });

  describe('2. Server-side Pricing Computation & Gateway Amount', () => {
    it('calculates totalPrice strictly from DB prices, ignoring client-supplied price', async () => {
      // 120 (base) + 40 (sauce) + 70 (cheese) + 45 (veg1) + 40 (veg2) = 315 INR
      let sentAmountPaise = 0;
      const createOrderSpy = jest.spyOn(paymentService, 'createRazorpayOrder')
        .mockImplementationOnce(async (amount) => {
          sentAmountPaise = amount;
          return {
            id: 'order_rzp_mock_price_123',
            amount,
            currency: 'INR',
          };
        });

      const res = await request(app)
        .post('/api/orders/create-razorpay-order')
        .set('Cookie', customerCookie)
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id, vegOpt2._id],
          totalPrice: 1, // Tampered client price!
          price: 50,
          amount: 100,
        });

      expect(res.status).toBe(201);
      expect(sentAmountPaise).toBe(31500); // 315 INR in paise

      const savedOrder = await Order.findById(res.body.data.orderId);
      expect(savedOrder.totalPrice).toBe(315); // Authoritative DB total
      createOrderSpy.mockRestore();
    });

    it('returns HTTP 502 if Razorpay gateway fails during order creation', async () => {
      const createOrderSpy = jest.spyOn(paymentService, 'createRazorpayOrder')
        .mockRejectedValueOnce(new Error('Gateway timeout'));

      const res = await request(app)
        .post('/api/orders/create-razorpay-order')
        .set('Cookie', customerCookie)
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/payment gateway/i);
      createOrderSpy.mockRestore();
    });
  });

  describe('3. Inventory Pre-Check Before Razorpay Order Creation', () => {
    it('rejects order creation with HTTP 409 when base is out of stock', async () => {
      await InventoryItem.findOneAndUpdate(
        { linkedPizzaOption: baseOpt._id },
        { currentStock: 0 },
      );

      const res = await request(app)
        .post('/api/orders/create-razorpay-order')
        .set('Cookie', customerCookie)
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Ingredient out of stock: Thin Crust/i);
    });

    it('rejects order creation with HTTP 409 when selected vegetable is out of stock', async () => {
      await InventoryItem.findOneAndUpdate(
        { linkedPizzaOption: vegOpt2._id },
        { currentStock: 0 },
      );

      const res = await request(app)
        .post('/api/orders/create-razorpay-order')
        .set('Cookie', customerCookie)
        .send({
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id, vegOpt2._id],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Ingredient out of stock: Crisp Bell Peppers/i);
    });
  });

  describe('4. Server-Side Payment Verification & HMAC Verification', () => {
    let testOrder;
    const rzpOrderId = 'order_rzp_test_flow_999';

    beforeEach(async () => {
      testOrder = await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        razorpayOrderId: rzpOrderId,
      });
    });

    it('rejects missing verification fields with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          // Missing payment ID and signature
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/required/i);
    });

    it('rejects invalid or tampered HMAC signature with HTTP 400 and keeps order pending', async () => {
      const paymentId = 'pay_mock_123';
      const fakeSignature = 'bad_forged_signature_that_does_not_match';

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: fakeSignature,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid payment signature/i);

      // Verify order remained pending
      const checkOrder = await Order.findById(testOrder._id);
      expect(checkOrder.paymentStatus).toBe('pending');

      // Verify inventory was NOT decremented
      const baseInv = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseInv.currentStock).toBe(50);
    });

    it('rejects verification if order belongs to another customer with HTTP 403', async () => {
      const paymentId = 'pay_mock_other_123';
      const validSig = generateValidSignature(rzpOrderId, paymentId);

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', otherCustomerCookie) // Wrong customer!
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Unauthorized/i);
    });

    it('successfully verifies valid payment and marks order paid', async () => {
      const paymentId = 'pay_mock_valid_123';
      const validSig = generateValidSignature(rzpOrderId, paymentId);

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('paid');

      const confirmedOrder = await Order.findById(testOrder._id);
      expect(confirmedOrder.paymentStatus).toBe('paid');
      expect(confirmedOrder.razorpayPaymentId).toBe(paymentId);
      expect(confirmedOrder.razorpaySignature).toBe(validSig);
    });
  });

  describe('5. Inventory Decrement & Race Guard Verification', () => {
    it('decrements each required ingredient by exactly 1 upon successful payment', async () => {
      const rzpOrderId = 'order_rzp_decrement_check_111';
      await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id, vegOpt2._id],
        },
        totalPrice: 315,
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        razorpayOrderId: rzpOrderId,
      });

      const paymentId = 'pay_mock_dec_111';
      const validSig = generateValidSignature(rzpOrderId, paymentId);

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

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
    });

    it('performs zero vegetable decrement when vegetables array is empty', async () => {
      const rzpOrderId = 'order_rzp_no_veg_dec_222';
      await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [], // No vegetables
        },
        totalPrice: 230,
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        razorpayOrderId: rzpOrderId,
      });

      const paymentId = 'pay_mock_no_veg_222';
      const validSig = generateValidSignature(rzpOrderId, paymentId);

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res.status).toBe(200);

      // Vegetable stock must remain completely untouched at 50
      const [veg1Inv, veg2Inv] = await Promise.all([
        InventoryItem.findOne({ linkedPizzaOption: vegOpt1._id }),
        InventoryItem.findOne({ linkedPizzaOption: vegOpt2._id }),
      ]);

      expect(veg1Inv.currentStock).toBe(50);
      expect(veg2Inv.currentStock).toBe(50);
    });

    it('guards against stock race condition: rejects verification if ingredient went out of stock during payment', async () => {
      const rzpOrderId = 'order_rzp_race_guard_333';
      await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        razorpayOrderId: rzpOrderId,
      });

      // Stock drops to 0 before customer finishes paying
      await InventoryItem.findOneAndUpdate(
        { linkedPizzaOption: cheeseOpt._id },
        { currentStock: 0 },
      );

      const paymentId = 'pay_mock_race_333';
      const validSig = generateValidSignature(rzpOrderId, paymentId);

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/out of stock during payment verification/i);

      // Order must remain pending
      const checkOrder = await Order.findOne({ razorpayOrderId: rzpOrderId });
      expect(checkOrder.paymentStatus).toBe('pending');
    });

    it('rolls back inventory decrements if database transaction aborts during payment confirmation', async () => {
      const rzpOrderId = 'order_rzp_tx_abort_555';
      const orderDoc = await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        razorpayOrderId: rzpOrderId,
      });

      const paymentId = 'pay_mock_tx_abort_555';
      const validSig = generateValidSignature(rzpOrderId, paymentId);

      // Force an error during order.save inside transaction
      const saveSpy = jest.spyOn(Order.prototype, 'save')
        .mockRejectedValueOnce(new Error('Simulated DB failure during transaction'));

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/transaction/i);

      // Stock must remain unchanged at 50
      const baseInv = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseInv.currentStock).toBe(50);

      const checkOrder = await Order.findById(orderDoc._id);
      expect(checkOrder.paymentStatus).toBe('pending');

      saveSpy.mockRestore();
    });
  });

  describe('6. Idempotency Protections on Payment Verification', () => {
    it('returns HTTP 200 with alreadyConfirmed: true on duplicate verification without re-decrementing stock', async () => {
      const rzpOrderId = 'order_rzp_idempotent_444';
      await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        razorpayOrderId: rzpOrderId,
      });

      const paymentId = 'pay_mock_idem_444';
      const validSig = generateValidSignature(rzpOrderId, paymentId);

      // First verification call
      const res1 = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res1.status).toBe(200);
      expect(res1.body.data.paymentStatus).toBe('paid');

      // Check stock after first decrement: 50 -> 49
      const baseAfterFirst = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseAfterFirst.currentStock).toBe(49);

      // Second (duplicate/retried) verification call
      const res2 = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.alreadyConfirmed).toBe(true);

      // Crucial: stock MUST still be 49 (no second decrement!)
      const baseAfterSecond = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseAfterSecond.currentStock).toBe(49);
    });
  });

  describe('7. Order Retrieval & Status Polling APIs', () => {
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
        paymentStatus: 'paid',
        orderStatus: 'In Kitchen',
        razorpayOrderId: 'order_rzp_status_poll_555',
      });
    });

    it('returns customer orders on GET /api/orders/my-orders', async () => {
      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toHaveLength(1);
      expect(res.body.data.orders[0]._id).toBe(paidOrder._id.toString());
      expect(res.body.data.orders[0].items.base.name).toBe('Thin Crust');
    });

    it('returns orderStatus on GET /api/orders/:orderId/status for owner', async () => {
      const res = await request(app)
        .get(`/api/orders/${paidOrder._id}/status`)
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderStatus).toBe('In Kitchen');
      expect(res.body.data.paymentStatus).toBe('paid');
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

  describe('8. Transaction-Unavailable Sequenced Fallback Path (§9.7)', () => {
    let originalTxAvailable;

    beforeEach(() => {
      originalTxAvailable = global.TRANSACTION_AVAILABLE;
      global.TRANSACTION_AVAILABLE = false;
    });

    afterEach(() => {
      global.TRANSACTION_AVAILABLE = originalTxAvailable;
    });

    it('successfully confirms payment and decrements inventory through sequenced fallback path', async () => {
      const rzpOrderId = 'order_rzp_fallback_success_777';
      const order = await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        razorpayOrderId: rzpOrderId,
      });

      const paymentId = 'pay_mock_fb_success_777';
      const validSig = generateValidSignature(rzpOrderId, paymentId);

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

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
    });

    it('handles duplicate verification idempotently in fallback mode without re-decrementing stock', async () => {
      const rzpOrderId = 'order_rzp_fallback_idem_888';
      await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        razorpayOrderId: rzpOrderId,
      });

      const paymentId = 'pay_mock_fb_idem_888';
      const validSig = generateValidSignature(rzpOrderId, paymentId);

      // First verification in fallback mode
      const res1 = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res1.status).toBe(200);

      const baseInvAfterFirst = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseInvAfterFirst.currentStock).toBe(49);

      // Second verification in fallback mode
      const res2 = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.alreadyConfirmed).toBe(true);

      const baseInvAfterSecond = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseInvAfterSecond.currentStock).toBe(49);
    });

    it('handles inventory write failure during fallback per §9.7 (order confirmed, compensating log + admin email alert)', async () => {
      const rzpOrderId = 'order_rzp_fallback_partial_fail_999';
      const order = await Order.create({
        customer: customerUser._id,
        items: {
          base: baseOpt._id,
          sauce: sauceOpt._id,
          cheese: cheeseOpt._id,
          vegetables: [vegOpt1._id],
        },
        totalPrice: 275,
        paymentStatus: 'pending',
        orderStatus: 'Order Received',
        razorpayOrderId: rzpOrderId,
      });

      const paymentId = 'pay_mock_fb_partial_999';
      const validSig = generateValidSignature(rzpOrderId, paymentId);

      // Spy on EmailService.sendInventoryFailureAlert and console.error
      const emailSpy = jest.spyOn(EmailService, 'sendInventoryFailureAlert').mockResolvedValue({});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate one inventory write failure during sequenced writes (e.g. race condition on vegOpt1 decrement)
      const origFindOneAndUpdate = InventoryItem.findOneAndUpdate.bind(InventoryItem);
      const invSpy = jest.spyOn(InventoryItem, 'findOneAndUpdate').mockImplementation((filter, ...args) => {
        if (
          filter &&
          filter.linkedPizzaOption &&
          filter.linkedPizzaOption.toString() === vegOpt1._id.toString() &&
          filter.currentStock
        ) {
          return Promise.resolve(null);
        }
        return origFindOneAndUpdate(filter, ...args);
      });

      const res = await request(app)
        .post('/api/orders/verify-payment')
        .set('Cookie', customerCookie)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      invSpy.mockRestore();

      // Per §9.7: "the order remains confirmed (payment already processed)"
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('paid');

      const savedOrder = await Order.findById(order._id);
      expect(savedOrder.paymentStatus).toBe('paid');

      // Per §9.7: "a compensating log entry is written"
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[COMPENSATING FALLBACK]'),
      );

      // Per §9.7: "the admin is alerted via email"
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: order._id,
          optionId: vegOpt1._id,
        }),
      );

      // In degraded sequenced fallback, base/sauce/cheese were decremented first,
      // confirming non-atomic degraded execution as documented in §9.7
      const baseInv = await InventoryItem.findOne({ linkedPizzaOption: baseOpt._id });
      expect(baseInv.currentStock).toBe(49);

      emailSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
