const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User.model');
const Admin = require('../src/models/Admin.model');
const PizzaOption = require('../src/models/PizzaOption.model');
const InventoryItem = require('../src/models/InventoryItem.model');
const { seedPizzaOptions, SEED_PIZZA_OPTIONS } = require('../src/scripts/seedPizzaOptions');
const seedAdmin = require('../src/scripts/seedAdmin');

describe('Phase 3 — Pizza Options & Inventory Models Tests', () => {
  let mongoServer;
  let customerCookie;

  beforeAll(async () => {
    require('dotenv').config();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_super_secret_key_at_least_64_characters_long_for_hs256_signing';
    process.env.JWT_EXPIRY = '7d';

    // In-memory MongoDB per project_plan.md §16.1 for hermetic test execution
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
    await PizzaOption.deleteMany({});
    await InventoryItem.deleteMany({});
    await User.deleteMany({});
    await Admin.deleteMany({});

    // Create and login authenticated test customer
    const user = await User.create({
      name: 'Catalogue Customer',
      email: 'catalogue_customer@example.com',
      passwordHash: await bcrypt.hash('customerPass123', 10),
      isVerified: true,
      role: 'customer',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'customerPass123' });

    customerCookie = loginRes.headers['set-cookie'];
  });

  describe('1. PizzaOption Model Schema & Constraints', () => {
    it('creates a valid PizzaOption with defaults', async () => {
      const option = await PizzaOption.create({
        category: 'base',
        name: 'Stuffed Crust',
        basePrice: 200,
      });

      expect(option._id).toBeDefined();
      expect(option.category).toBe('base');
      expect(option.name).toBe('Stuffed Crust');
      expect(option.basePrice).toBe(200);
      expect(option.isAvailable).toBe(true);
      expect(option.description).toBe('');
    });

    it('rejects invalid category enum values', async () => {
      await expect(
        PizzaOption.create({
          category: 'invalid_category',
          name: 'Invalid Item',
        }),
      ).rejects.toThrow();
    });

    it('rejects missing required category or name', async () => {
      await expect(
        PizzaOption.create({
          name: 'No Category',
        }),
      ).rejects.toThrow();

      await expect(
        PizzaOption.create({
          category: 'sauce',
        }),
      ).rejects.toThrow();
    });

    it('rejects negative basePrice', async () => {
      await expect(
        PizzaOption.create({
          category: 'cheese',
          name: 'Negative Cheese',
          basePrice: -50,
        }),
      ).rejects.toThrow();
    });

    it('enforces compound uniqueness on category + name', async () => {
      await PizzaOption.create({
        category: 'base',
        name: 'Unique Crust',
        basePrice: 100,
      });

      // Same category + same name should reject
      await expect(
        PizzaOption.create({
          category: 'base',
          name: 'Unique Crust',
          basePrice: 120,
        }),
      ).rejects.toThrow();

      // Same name in a DIFFERENT category is valid
      const diffCategory = await PizzaOption.create({
        category: 'sauce',
        name: 'Unique Crust',
        basePrice: 50,
      });
      expect(diffCategory._id).toBeDefined();
    });
  });

  describe('2. InventoryItem Model Schema & Constraints', () => {
    let testOption;

    beforeEach(async () => {
      testOption = await PizzaOption.create({
        category: 'vegetable',
        name: 'Green Olives',
        basePrice: 40,
      });
    });

    it('creates a valid InventoryItem linked to PizzaOption', async () => {
      const inv = await InventoryItem.create({
        name: testOption.name,
        category: testOption.category,
        currentStock: 100,
        lowStockThreshold: 20,
        unit: 'units',
        linkedPizzaOption: testOption._id,
      });

      expect(inv._id).toBeDefined();
      expect(inv.currentStock).toBe(100);
      expect(inv.lowStockThreshold).toBe(20);
      expect(inv.linkedPizzaOption.toString()).toBe(testOption._id.toString());
    });

    it('rejects negative currentStock and negative lowStockThreshold', async () => {
      await expect(
        InventoryItem.create({
          name: 'Negative Stock',
          category: 'vegetable',
          currentStock: -5,
          linkedPizzaOption: testOption._id,
        }),
      ).rejects.toThrow();

      await expect(
        InventoryItem.create({
          name: 'Negative Threshold',
          category: 'vegetable',
          currentStock: 10,
          lowStockThreshold: -1,
          linkedPizzaOption: testOption._id,
        }),
      ).rejects.toThrow();
    });

    it('enforces 1-to-1 relationship on linkedPizzaOption (rejects duplicates)', async () => {
      await InventoryItem.create({
        name: testOption.name,
        category: testOption.category,
        currentStock: 50,
        linkedPizzaOption: testOption._id,
      });

      // Second inventory item linking to the same PizzaOption must reject
      await expect(
        InventoryItem.create({
          name: 'Duplicate Linked Item',
          category: testOption.category,
          currentStock: 50,
          linkedPizzaOption: testOption._id,
        }),
      ).rejects.toThrow();
    });
  });

  describe('3. Seed Scripts and Option Counts', () => {
    it('seeds exactly 5 bases, 5 sauces, ≥3 cheeses, and ≥6 vegetables with matching inventory', async () => {
      const results = await seedPizzaOptions();
      expect(results.optionsCreated).toBe(SEED_PIZZA_OPTIONS.length);

      // Verify exact counts in DB
      const bases = await PizzaOption.find({ category: 'base' });
      const sauces = await PizzaOption.find({ category: 'sauce' });
      const cheeses = await PizzaOption.find({ category: 'cheese' });
      const vegetables = await PizzaOption.find({ category: 'vegetable' });

      expect(bases).toHaveLength(5);
      expect(sauces).toHaveLength(5);
      expect(cheeses.length).toBeGreaterThanOrEqual(3);
      expect(vegetables.length).toBeGreaterThanOrEqual(6);

      // Verify matching inventory item exists for EVERY pizza option with initial stock ≥ 50
      const allOptions = await PizzaOption.find({});
      const allInventory = await InventoryItem.find({});
      expect(allInventory).toHaveLength(allOptions.length);

      allInventory.forEach((inv) => {
        expect(inv.currentStock).toBeGreaterThanOrEqual(50);
        expect(inv.lowStockThreshold).toBe(20);
      });
    });

    it('is completely idempotent when run multiple times', async () => {
      await seedPizzaOptions();
      const firstOptionCount = await PizzaOption.countDocuments();
      const firstInventoryCount = await InventoryItem.countDocuments();

      // Second execution
      await seedPizzaOptions();
      const secondOptionCount = await PizzaOption.countDocuments();
      const secondInventoryCount = await InventoryItem.countDocuments();

      expect(secondOptionCount).toBe(firstOptionCount);
      expect(secondInventoryCount).toBe(firstInventoryCount);
    });

    it('seeds admin account and is idempotent on re-run', async () => {
      const admin = await seedAdmin();
      expect(admin).toBeDefined();
      expect(admin.role).toBe('admin');

      const adminCount1 = await Admin.countDocuments();
      expect(adminCount1).toBe(1);

      // Re-run seedAdmin
      const reseededAdmin = await seedAdmin();
      expect(reseededAdmin).toBeDefined();
      const adminCount2 = await Admin.countDocuments();
      expect(adminCount2).toBe(1);
    });
  });

  describe('4. Pizza Options API Endpoints', () => {
    beforeEach(async () => {
      await seedPizzaOptions();
    });

    it('rejects unauthenticated request to /api/pizza-options with HTTP 401', async () => {
      const res = await request(app).get('/api/pizza-options');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns all available pizza options grouped by category for authenticated customer', async () => {
      const res = await request(app)
        .get('/api/pizza-options')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.options).toBeDefined();
      expect(res.body.data.grouped).toBeDefined();
      expect(res.body.data.grouped.base).toHaveLength(5);
      expect(res.body.data.grouped.sauce).toHaveLength(5);
      expect(res.body.data.grouped.cheese.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.grouped.vegetable.length).toBeGreaterThanOrEqual(6);
    });

    it('returns exactly 5 base options when requesting /api/pizza-options/base', async () => {
      const res = await request(app)
        .get('/api/pizza-options/base')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category).toBe('base');
      expect(res.body.data.count).toBe(5);
      expect(res.body.data.options).toHaveLength(5);
    });

    it('returns exactly 5 sauce options when requesting /api/pizza-options/sauce', async () => {
      const res = await request(app)
        .get('/api/pizza-options/sauce')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category).toBe('sauce');
      expect(res.body.data.count).toBe(5);
      expect(res.body.data.options).toHaveLength(5);
    });

    it('rejects invalid category with HTTP 400', async () => {
      const res = await request(app)
        .get('/api/pizza-options/invalidCategory')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid category/);
    });

    it('filters out unavailable options (isAvailable: false)', async () => {
      // Mark one base as unavailable
      await PizzaOption.findOneAndUpdate(
        { category: 'base', name: 'Thin Crust' },
        { isAvailable: false },
      );

      const res = await request(app)
        .get('/api/pizza-options/base')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(4);
      expect(
        res.body.data.options.some((opt) => opt.name === 'Thin Crust'),
      ).toBe(false);
    });
  });
});
