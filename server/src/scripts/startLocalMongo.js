/* eslint-disable import/no-extraneous-dependencies */
const { MongoMemoryReplSet } = require('mongodb-memory-server');

/**
 * Local MongoDB ReplicaSet runner for demonstration and offline local development.
 * Provides a local MongoDB instance on port 27017 with multi-document transaction support.
 * Plan Reference: project_plan.md §9.7, .env.example
 */
(async () => {
  try {
    const replSet = await MongoMemoryReplSet.create({
      replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' },
      instanceOpts: [{ port: 27017 }],
    });
    console.log(`Local MongoDB running at port 27017: ${replSet.getUri()}pizza-delivery`);

    // Keep process alive
    setInterval(() => {}, 1000 * 60 * 60);

    const shutdown = async () => {
      console.log('Shutting down local MongoDB...');
      await replSet.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Failed to start local MongoDB instance:', err);
    process.exit(1);
  }
})();
