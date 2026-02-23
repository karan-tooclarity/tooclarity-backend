const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('../config/logger');
const Subscription = require('../models/Subscription');

const QUEUE_NAME = 'subscription-queue';

const redisConnection = require('../config/redisConfig');

const subscriptionQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

exports.scheduleDailyChecks = async () => {
  await subscriptionQueue.add('check-expirations', {}, {
    repeat: { cron: '0 1 * * *', tz: 'Asia/Kolkata' },
    jobId: 'daily-expiration-check',
  });
  logger.info('Daily subscription check has been scheduled.');
};

const createWorker = () => {
  new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === 'check-expirations') {
        logger.info('Running daily check for expired subscriptions...');
        const expired = await Subscription.updateMany(
          { status: 'active', endDate: { $lte: new Date() } },
          { $set: { status: 'expired' } }
        );
        if (expired.modifiedCount > 0) {
          logger.info(`Marked ${expired.modifiedCount} subscriptions as expired.`);
        } else {
          logger.info('No subscriptions to expire today.');
        }
      }
    },
    { connection: redisConnection }
  );
};

exports.createWorker = createWorker;
