const mongoose = require('mongoose');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const ShiftSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  startTime: { type: String, required: true, match: [TIME_REGEX, 'Use HH:MM format'] },
  endTime: { type: String, required: true, match: [TIME_REGEX, 'Use HH:MM format'] },
  gracePeriod: { type: Number, default: 15, min: 0, max: 120 },

  workingDays: [{ type: Number, min: 0, max: 6 }],

  overtimeRate: { type: Number, default: 1.5, min: 1, max: 5 },
  overtimeThreshold: { type: Number, default: 8, min: 0, max: 24 },

  breaks: [{
    name: String,
    startTime: { type: String, match: [TIME_REGEX, 'Use HH:MM format'] },
    endTime: { type: String, match: [TIME_REGEX, 'Use HH:MM format'] },
    isPaid: { type: Boolean, default: true }
  }],

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const UserShiftSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', required: true },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: Date,
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

UserShiftSchema.index({ userId: 1, effectiveFrom: -1 });

module.exports = {
  Shift: mongoose.model('Shift', ShiftSchema),
  UserShift: mongoose.model('UserShift', UserShiftSchema)
};
