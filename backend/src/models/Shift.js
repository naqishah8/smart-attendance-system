const mongoose = require('mongoose');

const ShiftSchema = new mongoose.Schema({
  name: { type: String, required: true }, // "Morning", "Evening", "Night"
  startTime: { type: String, required: true }, // "08:00"
  endTime: { type: String, required: true }, // "17:00"
  gracePeriod: { type: Number, default: 15 }, // minutes

  // Days of week (0=Sunday, 1=Monday, etc.)
  workingDays: [{ type: Number, min: 0, max: 6 }],

  // Overtime rules
  overtimeRate: { type: Number, default: 1.5 }, // multiplier
  overtimeThreshold: { type: Number, default: 8 }, // hours before OT starts

  // Break rules
  breaks: [{
    name: String,
    startTime: String,
    endTime: String,
    isPaid: { type: Boolean, default: true }
  }],

  isActive: { type: Boolean, default: true }
});

const UserShiftSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', required: true },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: Date,
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  Shift: mongoose.model('Shift', ShiftSchema),
  UserShift: mongoose.model('UserShift', UserShiftSchema)
};
