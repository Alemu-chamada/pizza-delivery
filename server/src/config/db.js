const dns = require('dns');
const mongoose = require('mongoose');

let listenersAttached = false;
let hasConnectedOnce = false;

/**
 * Sanitize a MongoDB connection URI to mask credentials in logs.
 * @param {string} uri - Raw connection URI
 * @returns {string} Sanitized URI
 */
const sanitizeMongoUri = (uri) => {
  if (!uri) return 'mongodb://127.0.0.1:27017/pizza-delivery';
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

/**
 * Attach global connection lifecycle event listeners to mongoose.connection.
 */
const attachConnectionListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => {
    if (hasConnectedOnce && process.env.NODE_ENV !== 'test') {
      console.log('[MongoDB] Connection disconnected');
    }
  });

  mongoose.connection.on('reconnected', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log('[MongoDB] Connection reconnected');
    }
  });

  mongoose.connection.on('error', (err) => {
    if (hasConnectedOnce && process.env.NODE_ENV !== 'test') {
      console.error('[MongoDB] Connection error');
      console.error(`[MongoDB] Error: ${err.message}`);
      if (err.code) {
        console.error(`[MongoDB] Code: ${err.code}`);
      }
    }
  });
};

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * Connect to MongoDB with retry logic and detailed lifecycle logging.
 * @param {object} options - Optional config (maxRetries, retryDelayMs, timeoutMS)
 * @returns {Promise<mongoose.Connection>}
 */
const connectDB = async (options = {}) => {
  attachConnectionListeners();

  const isTest = process.env.NODE_ENV === 'test';
  const mongoUri = process.env.MONGO_URI
    || process.env.MONGODB_URI
    || 'mongodb://127.0.0.1:27017/pizza-delivery?replicaSet=rs0';

  // Fix: Windows DNS SRV lookup failure (querySrv ECONNREFUSED) when resolver is 127.0.0.1
  if (mongoUri.startsWith('mongodb+srv://')) {
    try {
      const currentServers = dns.getServers();
      const hasLoopback = currentServers.includes('127.0.0.1')
        || currentServers.includes('::1');
      if (!currentServers || currentServers.length === 0 || hasLoopback) {
        dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
      }
    } catch {
      // DNS fallback is non-fatal
    }
  }

  const maxRetries = options.maxRetries || (isTest ? 1 : 4);
  const retryDelayMs = options.retryDelayMs || 2500;

  if (!isTest) {
    console.log('[MongoDB] Connecting to database...');
    console.log(`[MongoDB] Target: ${sanitizeMongoUri(mongoUri)}`);
  }

  /* eslint-disable no-await-in-loop */
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: options.timeoutMS || 8000,
      });

      hasConnectedOnce = true;

      // Probe for transaction capability
      const topologyType = conn.connection.client?.topology?.description?.type;
      const isReplicaSet = topologyType && topologyType.includes('ReplicaSet');
      global.TRANSACTION_AVAILABLE = Boolean(isReplicaSet);

      if (!isTest) {
        console.log('[MongoDB] Connected successfully');
        console.log(`[MongoDB] Database: ${conn.connection.name}`);
        console.log(`[MongoDB] Host: ${conn.connection.host}`);

        const host = conn.connection.host || '';
        const isAtlas = mongoUri.includes('.mongodb.net') || host.includes('.mongodb.net');
        if (isAtlas) {
          console.log('[MongoDB] Mode: MongoDB Atlas Cloud Database');
        } else if (host === '127.0.0.1' || host === 'localhost') {
          console.log('[MongoDB] Mode: In-memory development replica set (rs0)');
        } else {
          console.log('[MongoDB] Mode: External MongoDB Database');
        }

        console.log(`[MongoDB] Transactions available: ${global.TRANSACTION_AVAILABLE}`);
      }

      return conn;
    } catch (err) {
      if (!isTest) {
        console.error('[MongoDB] Connection failure');
        console.error(`[MongoDB] Target: ${sanitizeMongoUri(mongoUri)}`);
        console.error(`[MongoDB] Error: ${err.message}`);
        if (err.message && err.message.includes('querySrv')) {
          console.error('[MongoDB] DNS SRV lookup failed. Switching DNS to 8.8.8.8 / 1.1.1.1...');
          try {
            dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
          } catch {
            // DNS fallback is non-fatal
          }
        }
        if (err.code) {
          console.error(`[MongoDB] Error code: ${err.code}`);
        }
      }

      if (attempt < maxRetries) {
        if (!isTest) {
          console.log(`[MongoDB] Waiting for retry (Attempt ${attempt + 1}/${maxRetries}): ${err.message}`);
          console.log(`[MongoDB] Next retry in: ${retryDelayMs}ms`);
        }
        await sleep(retryDelayMs);
      } else {
        throw err;
      }
    }
  }
  /* eslint-enable no-await-in-loop */

  return null;
};

module.exports = connectDB;
module.exports.sanitizeMongoUri = sanitizeMongoUri;
