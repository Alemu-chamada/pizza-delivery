const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pizza-delivery';
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Probe for transaction support
    const topologyType = conn.connection.client.topology.description.type;
    const isReplicaSet = topologyType && topologyType.includes('ReplicaSet');

    global.TRANSACTION_AVAILABLE = isReplicaSet;
    console.log(`TRANSACTION_AVAILABLE: ${global.TRANSACTION_AVAILABLE}`);

    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
    return null;
  }
};

module.exports = connectDB;
