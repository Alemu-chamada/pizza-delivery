require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin.model');
const connectDB = require('../config/db');
const { BCRYPT_SALT_ROUNDS } = require('../config/constants');

/**
 * Seed an administrator account if one does not already exist.
 * Idempotent: Skips creation if the admin email is already present.
 */
const seedAdmin = async () => {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@pizzaapp.dev').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';

  const existingAdmin = await Admin.findOne({ email: adminEmail });
  if (existingAdmin) {
    console.log(`Admin account already exists for ${adminEmail}. Skipping seed.`);
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_SALT_ROUNDS);
  const newAdmin = await Admin.create({
    name: adminName,
    email: adminEmail,
    passwordHash,
    role: 'admin',
  });

  console.log(`Successfully seeded admin account: ${adminEmail}`);
  return newAdmin;
};

// If executed directly from command line
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seedAdmin();
      await mongoose.disconnect();
      console.log('Admin seed process finished.');
      process.exit(0);
    } catch (err) {
      console.error('Error during admin seeding:', err);
      process.exit(1);
    }
  })();
}

module.exports = seedAdmin;
