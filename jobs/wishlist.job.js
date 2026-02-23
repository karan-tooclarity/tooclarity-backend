const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('../config/logger');
const InstituteAdmin = require('../models/InstituteAdmin');

const QUEUE_NAME = 'wishlist-processing';

const redisConnection = require('../config/redisConfig');

const wishlistQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: true,
    removeOnFail: { count: 1000 },
  },
});

exports.addCourseToWishlistJob = async (userId, courseId) => {
  await wishlistQueue.add('add-course', { userId, courseId });
};

const createWishlistWorker = () => {
  logger.info(`Starting wishlist worker for queue: ${QUEUE_NAME}`);
  new Worker(
    QUEUE_NAME,
    async (job) => {
      const { userId, courseId } = job.data;
      logger.info(`Processing job ${job.id}: Add course ${courseId} to wishlist for user ${userId}`);

      try {
        const result = await InstituteAdmin.updateOne(
          { _id: userId, role: 'STUDENT' },
          { $addToSet: { wishlist: courseId } }
        );

        if (result.matchedCount === 0)
          throw new Error(`User ${userId} not found or is not a student`);

        if (result.modifiedCount === 0) {
          logger.warn(`Job ${job.id}: Course already in wishlist.`);
        } else {
          logger.info(`Job ${job.id}: Successfully added course.`);
        }
      } catch (error) {
        logger.error(`Job ${job.id} failed for user ${userId}: ${error.message}`);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 10,
      limiter: { max: 20, duration: 1000 },
    }
  );
};

exports.createWishlistWorker = createWishlistWorker;