const { Worker, Queue, QueueScheduler } = require('bullmq');
const Notification = require('../models/Notification');
const redisConnection = require('../config/redisConfig');

const FLUSH_QUEUE_NAME = 'flush-notifications';
const flushQueue = new Queue(FLUSH_QUEUE_NAME, { connection: redisConnection });

// Schedule the flush job (Cron-like)
exports.scheduleFlushJob = async () => {
    // Clean old repeated jobs to prevent duplicates
    const repeatableJobs = await flushQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
        await flushQueue.removeRepeatableByKey(job.key);
    }

    // Add new job running every 5 minutes
    await flushQueue.add('flushDB', {}, {
        repeat: {
            every: 300000, // 5 minutes
        },
        removeOnComplete: 10,
        removeOnFail: 50
    });
    console.log('[FlushWorker] Scheduled notification flush every 5 minutes');
};

// Worker that performs the Flush
exports.createFlushWorker = (connection) => {
    const worker = new Worker(FLUSH_QUEUE_NAME, async (job) => {
        const redis = connection || redisConnection;
        const BUFFER_KEY = 'buffer:notifications';
        const BATCH_SIZE = 1000;

        try {
            // Pipeline pop to get batch of items
            const pipeline = redis.pipeline();
            for (let i = 0; i < BATCH_SIZE; i++) {
                pipeline.lpop(BUFFER_KEY);
            }
            const results = await pipeline.exec();

            const docs = [];
            for (const [err, res] of results) {
                if (!err && res) {
                    try {
                        docs.push(JSON.parse(res));
                    } catch (e) {
                        console.error('[FlushWorker] JSON parse error', e);
                    }
                }
            }

            if (docs.length > 0) {
                console.log(`[FlushWorker] Inserting ${docs.length} notifications to Mongo`);
                await Notification.insertMany(docs, { ordered: false });
            } else {

            }

        } catch (err) {
            console.error('[FlushWorker] Flush failed', err);
        }

    }, {
        connection: connection || redisConnection
    });

    worker.on('error', err => console.error('[FlushWorker] Error', err));
    return worker;
};
