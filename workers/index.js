const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });

const fs = require('fs');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const redisConnection = require('../config/redisConfig.js');

(async () => {
  try {
    if (!process.env.MONGO_URI) {
      logger.error('❌ MONGO_URI is not set in environment variables.');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('✅ MongoDB connected successfully for workers');
  } catch (err) {
    logger.error('❌ MongoDB connection error in workers:', err.message);
    process.exit(1);
  }

  const jobsDir = path.join(__dirname, '../jobs');

  fs.readdirSync(jobsDir).forEach((file) => {
    if (!file.endsWith('.js')) return;

    const jobFile = require(path.join(jobsDir, file));

    if (typeof jobFile.createWishlistWorker === 'function') {
      jobFile.createWishlistWorker(redisConnection);
      logger.info(`🚀 Loaded wishlist worker from ${file}`);
    } else if (typeof jobFile.createWorker === 'function') {
      jobFile.createWorker(redisConnection);
      logger.info(`🚀 Loaded worker from ${file}`);
    } else if (typeof jobFile.startWorker === 'function') {
      jobFile.startWorker(redisConnection);
      logger.info(`🚀 Loaded worker from ${file}`);
    } else {
      logger.warn(`⚠️ ${file} does not export a worker initializer`);
    }
  });

  logger.info('🎯 All workers initialized and running!');

  process.on('SIGINT', async () => {
    logger.info('🛑 Gracefully shutting down workers...');
    await mongoose.disconnect();
    await redisConnection.quit();
    process.exit(0);
  });
})();