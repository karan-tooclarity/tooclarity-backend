const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { getIO } = require('../utils/socket'); // Assuming this utility exists based on context

const QUEUE_NAME = 'notifications';

const redisConnection = require('../config/redisConfig'); // Using existing config

const notificationQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

exports.addNotificationJob = async (payload) => {
  // console.log('[Queue DEBUG] adding notification job:', payload.recipientType);
  return notificationQueue.add('create', payload, {
    removeOnComplete: 500,
    removeOnFail: 1000,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
};

const createWorker = (connection) => {
  // Use passed connection or fallback to shared one
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      // console.log('[Worker DEBUG] Processing Job. ID:', job.id);
      const { title, description, category, recipientType, student, institution, branch, institutionAdmin, metadata } = job.data;

      // 1. Generate ID manually so we can send it to Frontend immediately
      const _id = new mongoose.Types.ObjectId();
      const createdAt = new Date();

      const doc = {
        _id,
        title,
        description,
        category,
        recipientType,
        student,
        institution,
        branch,
        institutionAdmin,
        metadata,
        read: false,
        createdAt,
        updatedAt: createdAt
      };

      // 2. Emit Socket Event IMMEDIATELY (Real-time speed)
      try {
        const io = getIO();
        if (io) {
          // console.log(`[Worker DEBUG] Emitting notification to recipientType: ${recipientType}`);
          if (recipientType === 'INSTITUTION' && institution) {
            io.to(`institution:${institution}`).emit('notificationCreated', { notification: doc });
          }
          if (recipientType === 'ADMIN' && institutionAdmin) {
            io.to(`institutionAdmin:${institutionAdmin}`).emit('notificationCreated', { notification: doc });
          }
          if (recipientType === 'STUDENT' && student) {
            io.to(`student:${student}`).emit('notificationCreated', { notification: doc });
          }
          if (recipientType === 'BRANCH' && branch) {
            io.to(`branch:${branch}`).emit('notificationCreated', { notification: doc });
          }
        }
      } catch (e) {
        console.error('Socket emit failed', e);
      }

      // 3. Push to Redis Buffer (Batched Delayed Write)
      try {
        const redis = connection || redisConnection;
        // Push as string to 'buffer:notifications'
        await redis.rpush('buffer:notifications', JSON.stringify(doc));
      } catch (err) {
        console.error('Failed to buffer notification to Redis', err);
        // Fallback: If Redis fails, try direct DB write or just fail safely
        await Notification.create(doc).catch(e => console.error('DB Fallback failed', e));
      }
    },
    {
      connection: connection || redisConnection,
      concurrency: 5,
      limiter: { max: 50, duration: 1000 },
    }
  );

  worker.on('error', (err) => {
    console.error('Notification worker error:', err?.message || err);
  });
};

exports.createWorker = createWorker;
