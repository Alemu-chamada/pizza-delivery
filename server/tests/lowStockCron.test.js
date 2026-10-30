const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const InventoryItem = require('../src/models/InventoryItem.model');
const PizzaOption = require('../src/models/PizzaOption.model');
const EmailService = require('../src/services/email.service');
const {
  checkLowStockAndAlert,
  initLowStockCron,
  stopLowStockCron,
} = require('../src/jobs/lowStockCheck');

describe('Phase 7 — Scheduled Job and Low-Stock Email Tests', () => {
  let mongoServer;
  let baseOption;
  let sauceOption;
  let cheeseOption;

  beforeAll(async () => {
    require('dotenv').config();
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_ALERT_EMAIL = 'admin_tester@pizzaapp.dev';
    process.env.EMAIL_FROM = 'alerts@pizzaapp.dev';
    process.env.CRON_SCHEDULE = '*/30 * * * *';

    mongoServer = await MongoMemoryServer.create();
    const testUri = mongoServer.getUri();

    await mongoose.connect(testUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
    });
  }, 120000);

  afterAll(async () => {
    stopLowStockCron();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    stopLowStockCron();
    await InventoryItem.deleteMany({});
    await PizzaOption.deleteMany({});
    jest.restoreAllMocks();

    baseOption = await PizzaOption.create({
      name: 'Gluten-Free Crust',
      category: 'base',
      basePrice: 180,
      isAvailable: true,
    });

    sauceOption = await PizzaOption.create({
      name: 'Spicy Arrabbiata',
      category: 'sauce',
      basePrice: 60,
      isAvailable: true,
    });

    cheeseOption = await PizzaOption.create({
      name: 'Vegan Mozzarella',
      category: 'cheese',
      basePrice: 90,
      isAvailable: true,
    });
  });

  describe('1. Low-Stock Detection Condition (< vs <= and custom thresholds)', () => {
    it('detects an item when currentStock is strictly less than lowStockThreshold (19 < 20)', async () => {
      await InventoryItem.create({
        name: 'Gluten-Free Dough',
        category: 'base',
        currentStock: 19,
        lowStockThreshold: 20,
        linkedPizzaOption: baseOption._id,
      });

      const spySendEmail = jest
        .spyOn(EmailService, 'sendLowStockAlert')
        .mockResolvedValue({ messageId: 'mock-msg-1' });

      const result = await checkLowStockAndAlert();

      expect(result.alerted).toBe(true);
      expect(result.count).toBe(1);
      expect(result.items[0].name).toBe('Gluten-Free Dough');
      expect(spySendEmail).toHaveBeenCalledTimes(1);
    });

    it('does NOT detect an item when currentStock is exactly at threshold (20 == 20)', async () => {
      await InventoryItem.create({
        name: 'Gluten-Free Dough',
        category: 'base',
        currentStock: 20,
        lowStockThreshold: 20,
        linkedPizzaOption: baseOption._id,
      });

      const spySendEmail = jest
        .spyOn(EmailService, 'sendLowStockAlert')
        .mockResolvedValue({ messageId: 'mock-msg-2' });

      const result = await checkLowStockAndAlert();

      expect(result.alerted).toBe(false);
      expect(result.count).toBe(0);
      expect(spySendEmail).not.toHaveBeenCalled();
    });

    it('does NOT detect an item when currentStock is above threshold (21 > 20)', async () => {
      await InventoryItem.create({
        name: 'Gluten-Free Dough',
        category: 'base',
        currentStock: 21,
        lowStockThreshold: 20,
        linkedPizzaOption: baseOption._id,
      });

      const spySendEmail = jest
        .spyOn(EmailService, 'sendLowStockAlert')
        .mockResolvedValue({ messageId: 'mock-msg-3' });

      const result = await checkLowStockAndAlert();

      expect(result.alerted).toBe(false);
      expect(result.count).toBe(0);
      expect(spySendEmail).not.toHaveBeenCalled();
    });

    it('handles different non-default thresholds independently without hardcoded 20', async () => {
      // Item A: threshold 5, currentStock 4 -> LOW STOCK (4 < 5)
      await InventoryItem.create({
        name: 'Rare White Truffle Oil',
        category: 'sauce',
        currentStock: 4,
        lowStockThreshold: 5,
        linkedPizzaOption: sauceOption._id,
      });

      // Item B: threshold 50, currentStock 40 -> LOW STOCK (40 < 50)
      await InventoryItem.create({
        name: 'Bulk Cheese Block',
        category: 'cheese',
        currentStock: 40,
        lowStockThreshold: 50,
        linkedPizzaOption: cheeseOption._id,
      });

      // Item C: threshold 10, currentStock 10 -> NOT LOW STOCK (10 is not < 10)
      await InventoryItem.create({
        name: 'Gluten-Free Dough',
        category: 'base',
        currentStock: 10,
        lowStockThreshold: 10,
        linkedPizzaOption: baseOption._id,
      });

      const spySendEmail = jest
        .spyOn(EmailService, 'sendLowStockAlert')
        .mockResolvedValue({ messageId: 'mock-msg-4' });

      const result = await checkLowStockAndAlert();

      expect(result.alerted).toBe(true);
      expect(result.count).toBe(2);

      const itemNames = result.items.map((i) => i.name);
      expect(itemNames).toContain('Rare White Truffle Oil');
      expect(itemNames).toContain('Bulk Cheese Block');
      expect(itemNames).not.toContain('Gluten-Free Dough');

      expect(spySendEmail).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Rare White Truffle Oil', currentStock: 4, lowStockThreshold: 5 }),
          expect.objectContaining({ name: 'Bulk Cheese Block', currentStock: 40, lowStockThreshold: 50 }),
        ]),
      );
    });
  });

  describe('2. Email Alert Content, Recipient, and Aggregation Behavior', () => {
    it('sends an aggregated alert with populated linked pizza option details', async () => {
      await InventoryItem.create({
        name: 'Gluten-Free Dough Pack',
        category: 'base',
        currentStock: 8,
        lowStockThreshold: 20,
        unit: 'packs',
        linkedPizzaOption: baseOption._id,
      });

      const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'smtp-test-id' });
      jest.spyOn(EmailService, 'getTransporter').mockReturnValue({
        sendMail: mockSendMail,
      });

      const result = await checkLowStockAndAlert();

      expect(result.alerted).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe('admin_tester@pizzaapp.dev');
      expect(mailOptions.from).toBe('alerts@pizzaapp.dev');
      expect(mailOptions.subject).toMatch(/Low Stock Inventory Warning/i);
      expect(mailOptions.text).toContain('Gluten-Free Dough Pack');
      expect(mailOptions.text).toContain('Current Stock = 8 packs');
      expect(mailOptions.text).toContain('Threshold: 20 packs');
      expect(mailOptions.html).toContain('Gluten-Free Dough Pack');
      expect(mailOptions.html).toContain('Gluten-Free Crust');
    });

    it('does NOT invoke sendMail or sendLowStockAlert when zero items are low in stock', async () => {
      await InventoryItem.create({
        name: 'Plentiful Dough',
        category: 'base',
        currentStock: 100,
        lowStockThreshold: 20,
        linkedPizzaOption: baseOption._id,
      });

      const mockSendMail = jest.fn();
      jest.spyOn(EmailService, 'getTransporter').mockReturnValue({
        sendMail: mockSendMail,
      });

      const result = await checkLowStockAndAlert();

      expect(result.alerted).toBe(false);
      expect(result.count).toBe(0);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('catches and logs errors without crashing or throwing an unhandled exception', async () => {
      await InventoryItem.create({
        name: 'Failing Item',
        category: 'base',
        currentStock: 5,
        lowStockThreshold: 20,
        linkedPizzaOption: baseOption._id,
      });

      // Simulate an SMTP connection breakdown
      jest.spyOn(EmailService, 'getTransporter').mockReturnValue({
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP connection timed out')),
      });

      const spyConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await checkLowStockAndAlert();

      expect(result.alerted).toBe(false);
      expect(result.error).toBe('SMTP connection timed out');
      expect(spyConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[LowStockCheckJob] Error during scheduled inventory check:'),
        expect.any(Error),
      );
    });
  });

  describe('3. Scheduler Initialization, Configuration, and Singleton Protection', () => {
    it('initializes the cron job with the configured CRON_SCHEDULE expression', () => {
      const task = initLowStockCron('*/15 * * * *');
      expect(task).not.toBeNull();
      expect(typeof task.stop).toBe('function');
    });

    it('prevents duplicate cron registrations in the same process (singleton guard)', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const task1 = initLowStockCron('*/30 * * * *');
      const task2 = initLowStockCron('*/30 * * * *');

      expect(task1).toBe(task2);
      expect(spyWarn).toHaveBeenCalledWith(
        expect.stringContaining('Cron job already initialized'),
      );
    });

    it('rejects invalid cron expression and logs error without crashing', () => {
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = initLowStockCron('invalid * cron * expression * 99');

      expect(result).toBeNull();
      expect(spyError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid CRON_SCHEDULE expression'),
      );
    });

    it('cleanly stops and resets cron job via stopLowStockCron()', () => {
      const task = initLowStockCron('*/10 * * * *');
      expect(task).not.toBeNull();

      stopLowStockCron();

      // After stopping, should be able to register a new instance without duplicate warning
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const newTask = initLowStockCron('*/20 * * * *');

      expect(newTask).not.toBeNull();
      expect(spyWarn).not.toHaveBeenCalled();
    });
  });

  describe('4. Preservation of Existing Email & Inventory Operations', () => {
    it('preserves sendInventoryFailureAlert functionality from Phase 4', async () => {
      const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'fallback-id' });
      jest.spyOn(EmailService, 'getTransporter').mockReturnValue({
        sendMail: mockSendMail,
      });

      await EmailService.sendInventoryFailureAlert({
        orderId: 'order_123',
        optionId: 'opt_456',
        reason: 'Version conflict error',
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.subject).toContain('Compensating Fallback Inventory Failure on Order order_123');
      expect(call.text).toContain('Version conflict error');
    });
  });
});
