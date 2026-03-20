/**
 * Migration: Add consent tracking fields to existing users.
 *
 * Up:   Sets consent = { faceRecognition: false, emotionTracking: false,
 *       locationTracking: false, dataProcessing: false } on users missing it.
 * Down: Removes the consent field from all users.
 */
const mongoose = require('mongoose');

module.exports = {
  async up() {
    const result = await mongoose.connection.collection('users').updateMany(
      { consent: { $exists: false } },
      {
        $set: {
          consent: {
            faceRecognition: false,
            emotionTracking: false,
            locationTracking: false,
            dataProcessing: false,
            lastUpdated: null
          }
        }
      }
    );

    console.log(`  Updated ${result.modifiedCount} user records`);
  },

  async down() {
    const result = await mongoose.connection.collection('users').updateMany(
      {},
      { $unset: { consent: '' } }
    );

    console.log(`  Reverted ${result.modifiedCount} user records`);
  }
};
