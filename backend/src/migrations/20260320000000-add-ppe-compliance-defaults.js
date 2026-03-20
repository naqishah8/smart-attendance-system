/**
 * Migration: Add PPE compliance defaults to existing attendance detections.
 *
 * Up:   Sets ppeCompliance = { helmet: false, vest: false, goggles: false, gloves: false }
 *       on all detections that don't already have it.
 * Down: Removes the ppeCompliance field from all detections.
 */
const mongoose = require('mongoose');

module.exports = {
  async up() {
    const result = await mongoose.connection.collection('attendances').updateMany(
      { 'detections.ppeCompliance': { $exists: false } },
      {
        $set: {
          'detections.$[elem].ppeCompliance': {
            helmet: false,
            vest: false,
            goggles: false,
            gloves: false
          }
        }
      },
      {
        arrayFilters: [{ 'elem.ppeCompliance': { $exists: false } }]
      }
    );

    console.log(`  Updated ${result.modifiedCount} attendance records`);
  },

  async down() {
    const result = await mongoose.connection.collection('attendances').updateMany(
      {},
      { $unset: { 'detections.$[].ppeCompliance': '' } }
    );

    console.log(`  Reverted ${result.modifiedCount} attendance records`);
  }
};
