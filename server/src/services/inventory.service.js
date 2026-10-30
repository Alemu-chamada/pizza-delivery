const InventoryItem = require('../models/InventoryItem.model');
const PizzaOption = require('../models/PizzaOption.model');
const EmailService = require('./email.service');

/**
 * Inventory Service
 * Manages stock availability checks and atomic stock decrements.
 * Plan Reference: project_plan.md §7.3, §9.5, §9.7, §10.3, §18 C4
 */

/**
 * Checks if sufficient stock (currentStock >= 1) exists for all requested pizza option IDs.
 * @param {Array<string|mongoose.Types.ObjectId>} optionIds - Array of PizzaOption ObjectIds.
 * @returns {Promise<{ available: boolean, missingItem?: string }>}
 */
const checkStock = async (optionIds) => {
  if (!optionIds || optionIds.length === 0) {
    return { available: true };
  }

  // Find all corresponding inventory items
  const inventoryItems = await InventoryItem.find({
    linkedPizzaOption: { $in: optionIds },
  });

  const inventoryMap = new Map();
  inventoryItems.forEach((item) => {
    inventoryMap.set(item.linkedPizzaOption.toString(), item);
  });

  for (let i = 0; i < optionIds.length; i += 1) {
    const idStr = optionIds[i].toString();
    const invItem = inventoryMap.get(idStr);

    if (!invItem) {
      // Look up PizzaOption name for descriptive error message if possible
      // eslint-disable-next-line no-await-in-loop
      const option = await PizzaOption.findById(idStr);
      return {
        available: false,
        missingItem: option ? option.name : idStr,
      };
    }

    if (invItem.currentStock < 1) {
      return {
        available: false,
        missingItem: invItem.name,
      };
    }
  }

  return { available: true };
};

/**
 * Decrements currentStock by 1 for each option in optionIds.
 * Guards against negative stock using conditional query { currentStock: { $gte: 1 } }.
 * In transaction mode (session !== null), throws on failure to trigger rollback.
 * In fallback mode (session === null), logs compensating alert and notifies admin per §9.7.
 * @param {Array<string|mongoose.Types.ObjectId>} optionIds - Distinct PizzaOption ObjectIds.
 * @param {mongoose.ClientSession|null} session - Active Mongoose transaction session (or null).
 * @param {string|mongoose.Types.ObjectId|null} orderId - Confirmed Order ID for fallback tracing.
 * @returns {Promise<Array<Object>>} Array of updated InventoryItem documents.
 */
const decrementStock = async (optionIds, session = null, orderId = null) => {
  if (!optionIds || optionIds.length === 0) {
    return [];
  }

  const updatedItems = [];
  const queryOptions = { returnDocument: 'after' };
  if (session) {
    queryOptions.session = session;
  }

  for (let i = 0; i < optionIds.length; i += 1) {
    const optionId = optionIds[i];

    // eslint-disable-next-line no-await-in-loop
    const updated = await InventoryItem.findOneAndUpdate(
      {
        linkedPizzaOption: optionId,
        currentStock: { $gte: 1 },
      },
      {
        $inc: { currentStock: -1 },
        $set: { updatedAt: new Date() },
      },
      queryOptions,
    );

    if (!updated) {
      const errorMsg = `Insufficient stock or ingredient not found for option ${optionId}`;
      if (session) {
        throw new Error(errorMsg);
      } else {
        // Compensating write fallback per §9.7: log entry + email alert
        console.error(
          `[COMPENSATING FALLBACK] Failed to decrement inventory for option ${optionId} on confirmed order ${orderId || 'unknown'}: ${errorMsg}`,
        );
        try {
          // eslint-disable-next-line no-await-in-loop
          await EmailService.sendInventoryFailureAlert({
            orderId: orderId || 'unknown',
            optionId,
            reason: errorMsg,
          });
        } catch (emailErr) {
          console.error('[COMPENSATING FALLBACK] Failed to send admin email alert:', emailErr.message);
        }
      }
    } else {
      updatedItems.push(updated);
    }
  }

  return updatedItems;
};

module.exports = {
  checkStock,
  decrementStock,
};
