const cron = require('node-cron');
const User = require('../models/User');

// This task runs every day at midnight (00:00)
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily biometric data cleanup...');
  
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find users who have face data and were created/updated a week ago
    // and clear only the biometric field
    const result = await User.updateMany(
      { 
        faceDescriptor: { $exists: true, $ne: [] },
        updatedAt: { $lt: sevenDaysAgo } 
      },
      { $set: { faceDescriptor: [] } }
    );

    console.log(`✅ Cleanup complete. Removed data from ${result.modifiedCount} users.`);
  } catch (err) {
    console.error(' Cleanup failed:', err);
  }
});