require('dotenv').config();
const mongoose = require('mongoose');
const PizzaOption = require('../models/PizzaOption.model');
const InventoryItem = require('../models/InventoryItem.model');
const connectDB = require('../config/db');

const SEED_PIZZA_OPTIONS = [
  // ── 5 Bases (Mandatory assignment requirement) ──
  {
    category: 'base',
    name: 'Thin Crust',
    description: 'Light, crunchy traditional Italian crust',
    basePrice: 150,
    imageUrl: '/images/options/thin-crust.png',
    isAvailable: true,
  },
  {
    category: 'base',
    name: 'Hand Tossed',
    description: 'Warm, soft and traditional thick crust',
    basePrice: 180,
    imageUrl: '/images/options/hand-tossed.png',
    isAvailable: true,
  },
  {
    category: 'base',
    name: 'Cheese Burst',
    description: 'Crust stuffed with hot molten cheese',
    basePrice: 250,
    imageUrl: '/images/options/cheese-burst.png',
    isAvailable: true,
  },
  {
    category: 'base',
    name: 'Pan Pizza',
    description: 'Fresh pan-baked dough with crispy golden edges',
    basePrice: 200,
    imageUrl: '/images/options/pan-pizza.png',
    isAvailable: true,
  },
  {
    category: 'base',
    name: 'Wheat Thin Crust',
    description: 'Healthy whole wheat thin crust',
    basePrice: 220,
    imageUrl: '/images/options/wheat-crust.png',
    isAvailable: true,
  },

  // ── 5 Sauces (Mandatory assignment requirement) ──
  {
    category: 'sauce',
    name: 'Classic Tomato Herb',
    description: 'Rich Italian sun-ripened tomato sauce with herbs',
    basePrice: 50,
    imageUrl: '/images/options/classic-tomato.png',
    isAvailable: true,
  },
  {
    category: 'sauce',
    name: 'Spicy Red Marinara',
    description: 'Bold and fiery red marinara with crushed chili',
    basePrice: 60,
    imageUrl: '/images/options/spicy-marinara.png',
    isAvailable: true,
  },
  {
    category: 'sauce',
    name: 'Creamy Garlic Parmesan',
    description: 'Velvety garlic white sauce infused with parmesan',
    basePrice: 80,
    imageUrl: '/images/options/creamy-garlic.png',
    isAvailable: true,
  },
  {
    category: 'sauce',
    name: 'Smoky BBQ Sauce',
    description: 'Sweet and tangy hickory smoked barbecue sauce',
    basePrice: 70,
    imageUrl: '/images/options/smoky-bbq.png',
    isAvailable: true,
  },
  {
    category: 'sauce',
    name: 'Basil Pesto',
    description: 'Fragrant fresh basil, pine nuts, and extra virgin olive oil',
    basePrice: 90,
    imageUrl: '/images/options/basil-pesto.png',
    isAvailable: true,
  },

  // ── Cheese (At least 3 options per plan — 4 provided) ──
  {
    category: 'cheese',
    name: 'Mozzarella',
    description: 'Classic stretchy Italian mozzarella',
    basePrice: 80,
    imageUrl: '/images/options/mozzarella.png',
    isAvailable: true,
  },
  {
    category: 'cheese',
    name: 'Cheddar',
    description: 'Aged sharp golden cheddar',
    basePrice: 90,
    imageUrl: '/images/options/cheddar.png',
    isAvailable: true,
  },
  {
    category: 'cheese',
    name: 'Parmesan',
    description: 'Sharp and nutty finely grated parmesan',
    basePrice: 100,
    imageUrl: '/images/options/parmesan.png',
    isAvailable: true,
  },
  {
    category: 'cheese',
    name: 'Ricotta',
    description: 'Light, creamy, and mildly sweet fresh cheese',
    basePrice: 110,
    imageUrl: '/images/options/ricotta.png',
    isAvailable: true,
  },

  // ── Vegetables (At least 6 options per plan — 7 provided) ──
  {
    category: 'vegetable',
    name: 'Crisp Bell Peppers',
    description: 'Fresh green, red, and yellow bell pepper slices',
    basePrice: 40,
    imageUrl: '/images/options/bell-peppers.png',
    isAvailable: true,
  },
  {
    category: 'vegetable',
    name: 'Sliced Mushrooms',
    description: 'Earthy button mushrooms freshly sliced',
    basePrice: 50,
    imageUrl: '/images/options/mushrooms.png',
    isAvailable: true,
  },
  {
    category: 'vegetable',
    name: 'Red Onions',
    description: 'Sweet red onion rings',
    basePrice: 30,
    imageUrl: '/images/options/red-onions.png',
    isAvailable: true,
  },
  {
    category: 'vegetable',
    name: 'Black Olives',
    description: 'Tender pitted Spanish black olives',
    basePrice: 60,
    imageUrl: '/images/options/black-olives.png',
    isAvailable: true,
  },
  {
    category: 'vegetable',
    name: 'Golden Sweet Corn',
    description: 'Juicy golden sweet corn kernels',
    basePrice: 40,
    imageUrl: '/images/options/sweet-corn.png',
    isAvailable: true,
  },
  {
    category: 'vegetable',
    name: 'Jalapenos',
    description: 'Spicy pickled green jalapeno slices',
    basePrice: 50,
    imageUrl: '/images/options/jalapenos.png',
    isAvailable: true,
  },
  {
    category: 'vegetable',
    name: 'Fresh Tomatoes',
    description: 'Diced juicy Roma tomatoes',
    basePrice: 30,
    imageUrl: '/images/options/fresh-tomatoes.png',
    isAvailable: true,
  },
];

/**
 * Seed PizzaOptions and matching InventoryItems.
 * Idempotent: Uses findOneAndUpdate / upsert to avoid duplicate records on multiple runs.
 */
const seedPizzaOptions = async () => {
  console.log('Seeding pizza options and inventory items...');
  const results = {
    optionsCreated: 0,
    inventoryCreated: 0,
  };

  await Promise.all(
    SEED_PIZZA_OPTIONS.map(async (optionData) => {
      // Upsert PizzaOption by category and name
      const option = await PizzaOption.findOneAndUpdate(
        { category: optionData.category, name: optionData.name },
        { $set: optionData },
        { upsert: true, returnDocument: 'after', runValidators: true },
      );
      results.optionsCreated += 1;

      // Upsert matching InventoryItem linked to PizzaOption
      await InventoryItem.findOneAndUpdate(
        { linkedPizzaOption: option._id },
        {
          $setOnInsert: {
            currentStock: 100, // Initial development stock ≥ 50 units
            lowStockThreshold: Number(process.env.LOW_STOCK_THRESHOLD) || 20,
            unit: 'units',
          },
          $set: {
            name: option.name,
            category: option.category,
            updatedAt: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: true },
      );
      results.inventoryCreated += 1;
    }),
  );

  console.log(
    `Seeding complete. Processed ${results.optionsCreated} options and ${results.inventoryCreated} inventory records.`,
  );
  return results;
};

// If executed directly from command line
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seedPizzaOptions();
      await mongoose.disconnect();
      console.log('Pizza options seed process finished.');
      process.exit(0);
    } catch (err) {
      console.error('Error during pizza options seeding:', err);
      process.exit(1);
    }
  })();
}

module.exports = {
  seedPizzaOptions,
  SEED_PIZZA_OPTIONS,
};
