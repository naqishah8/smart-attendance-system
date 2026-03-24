const mongoose = require('mongoose');

// ── Leave Policy (company-wide per leave type) ──────────────────
const LeavePolicySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: {
    type: String, required: true, unique: true, trim: true,
    enum: ['annual', 'sick', 'casual', 'maternity', 'paternity', 'compassionate', 'unpaid']
  },
  daysPerYear: { type: Number, required: true, min: 0 },
  carryForward: { type: Boolean, default: false },
  maxCarryDays: { type: Number, default: 0 },
  requiresDocument: { type: Boolean, default: false }, // e.g., medical cert for sick leave
  minNoticeDays: { type: Number, default: 0 }, // advance notice required
  isActive: { type: Boolean, default: true },
  applicableTo: { type: String, enum: ['all', 'male', 'female'], default: 'all' },
}, { timestamps: true });

// ── Leave Balance (per employee per year) ───────────────────────
const LeaveBalanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  year: { type: Number, required: true },
  balances: [{
    leaveType: { type: String, required: true },
    allocated: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    carriedForward: { type: Number, default: 0 },
    pending: { type: Number, default: 0 }, // days in pending requests
  }],
}, { timestamps: true });

LeaveBalanceSchema.index({ userId: 1, year: 1 }, { unique: true });

// ── Leave Request ───────────────────────────────────────────────
const LeaveRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType: {
    type: String, required: true,
    enum: ['annual', 'sick', 'casual', 'maternity', 'paternity', 'compassionate', 'unpaid']
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalDays: { type: Number, required: true, min: 0.5 },
  isHalfDay: { type: Boolean, default: false },
  halfDayPeriod: { type: String, enum: ['morning', 'afternoon'] },

  reason: { type: String, required: true, trim: true, maxlength: 500 },
  documentUrl: String, // supporting document (medical cert, etc.)

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },

  // Approval chain
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewNote: { type: String, trim: true, maxlength: 500 },

  // Emergency/backdated leave
  isEmergency: { type: Boolean, default: false },

  // Cancellation
  cancelledAt: Date,
  cancelReason: String,
}, { timestamps: true });

LeaveRequestSchema.index({ userId: 1, status: 1 });
LeaveRequestSchema.index({ status: 1, createdAt: -1 });
LeaveRequestSchema.index({ startDate: 1, endDate: 1 });

// ── Company Holiday ─────────────────────────────────────────────
const HolidaySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  type: { type: String, enum: ['public', 'company', 'optional'], default: 'public' },
  isRecurring: { type: Boolean, default: false }, // repeats yearly
  year: { type: Number, required: true },
}, { timestamps: true });

HolidaySchema.index({ date: 1 });
HolidaySchema.index({ year: 1 });

// ── Overtime Request ────────────────────────────────────────────
const OvertimeRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  hours: { type: Number, required: true, min: 0.5, max: 8 },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewNote: String,
}, { timestamps: true });

OvertimeRequestSchema.index({ userId: 1, status: 1 });
OvertimeRequestSchema.index({ status: 1, date: -1 });

const LeavePolicy = mongoose.model('LeavePolicy', LeavePolicySchema);
const LeaveBalance = mongoose.model('LeaveBalance', LeaveBalanceSchema);
const LeaveRequest = mongoose.model('LeaveRequest', LeaveRequestSchema);
const Holiday = mongoose.model('Holiday', HolidaySchema);
const OvertimeRequest = mongoose.model('OvertimeRequest', OvertimeRequestSchema);

module.exports = { LeavePolicy, LeaveBalance, LeaveRequest, Holiday, OvertimeRequest };
