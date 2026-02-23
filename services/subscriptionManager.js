const cron = require('node-cron');
const Subscription = require('../models/Subscription');

// Run this job every day at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily subscription check...');
  
  try {
    const expiredSubscriptions = await Subscription.updateMany(
      {
        status: 'active',
        endDate: { $lt: new Date() },
      },
      {
        $set: { status: 'expired' },
      }
    );
    
    if (expiredSubscriptions.modifiedCount > 0) {
      console.log(`Updated ${expiredSubscriptions.modifiedCount} subscriptions to 'expired'.`);
    }
  } catch (error) {
    console.error('Error checking for expired subscriptions:', error);
  }
});