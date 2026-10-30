const cron = require('node-cron');
const InventoryItem = require('../models/InventoryItem.model');
const EmailService = require('../services/email.service');

let cronJobInstance = null;

/**
 * Executes a single low-stock inventory check.
 * Queries all inventory items where currentStock < lowStockThreshold,
 * populates linked pizza options, and dispatches an aggregated alert email
 * to the administrator if any items are below threshold.
 *
 * Plan Reference: project_plan.md §4.2 (FR-A06), §10.5
 *
 * @returns {Promise<{ alerted: boolean, count: number, items: Array, error?: string }>}
 */
const checkLowStockAndAlert = async () => {
  try {
    // Query inventory items where currentStock is strictly less than lowStockThreshold.
    // Uses Mongoose $expr comparison and defensive JavaScript filter.
    const candidates = await InventoryItem.find({
      $expr: { $lt: ['$currentStock', '$lowStockThreshold'] },
    }).populate('linkedPizzaOption');

    const lowStockItems = candidates.filter(
      (item) => item.currentStock < item.lowStockThreshold,
    );

    if (lowStockItems.length === 0) {
      return {
        alerted: false,
        count: 0,
        items: [],
      };
    }

    // Dispatch aggregated low-stock email
    await EmailService.sendLowStockAlert(lowStockItems);

    return {
      alerted: true,
      count: lowStockItems.length,
      items: lowStockItems,
    };
  } catch (error) {
    // Errors in the scheduled job must be logged to console.error
    // and must not crash the server process
    console.error('[LowStockCheckJob] Error during scheduled inventory check:', error);
    return {
      alerted: false,
      count: 0,
      items: [],
      error: error.message,
    };
  }
};

/**
 * Initializes the node-cron scheduled job.
 * Defaults to every 30 minutes ('*\/30 * * * *') per project_plan.md §10.5.
 * Guarantees singleton registration (prevents duplicate scheduler instances).
 *
 * @param {string} [customSchedule] - Optional cron expression override
 * @returns {object|null} node-cron ScheduledTask instance or null if skipped
 */
const initLowStockCron = (customSchedule) => {
  const schedule = customSchedule || process.env.CRON_SCHEDULE || '*/30 * * * *';

  if (!cron.validate(schedule)) {
    console.error(
      `[LowStockCheckJob] Invalid CRON_SCHEDULE expression: '${schedule}'. Cron job not started.`,
    );
    return null;
  }

  // Prevent duplicate cron registrations in the same application process
  if (cronJobInstance) {
    console.warn(
      '[LowStockCheckJob] Cron job already initialized. Skipping duplicate registration.',
    );
    return cronJobInstance;
  }

  cronJobInstance = cron.schedule(schedule, async () => {
    await checkLowStockAndAlert();
  });

  return cronJobInstance;
};

/**
 * Stops and destroys any active cron scheduler instance.
 * Useful for test suites and graceful application shutdown.
 */
const stopLowStockCron = () => {
  if (cronJobInstance) {
    cronJobInstance.stop();
    cronJobInstance = null;
  }
};

module.exports = {
  checkLowStockAndAlert,
  initLowStockCron,
  stopLowStockCron,
};
