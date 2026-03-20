const mongoose = require('mongoose');

const FineSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Fine types
  type: {
    category: {
      type: String,
      enum: ['late', 'absent', 'early-departure', 'safety-violation', 'ppe-violation', 'other']
    },
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FineRule' }
  },

  // Attendance reference (if applicable)
  attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
  detectionId: { type: mongoose.Schema.Types.ObjectId }, // Specific detection that triggered fine

  // Amounts
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },

  // Evidence
  evidence: {
    videoClip: String, // URL to video clip
    snapshotUrl: String,
    description: String,
    timestamp: Date
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'applied', 'disputed', 'waived'],
    default: 'pending'
  },

  // Dispute handling
  dispute: {
    reason: String,
    filedAt: Date,
    resolvedAt: Date,
    resolution: String
  },

  createdAt: { type: Date, default: Date.now }
});

const FineRuleSchema = new mongoose.Schema({
  name: String,
  category: { type: String, enum: ['late', 'absent', 'safety', 'ppe'] },

  // Conditions
  condition: {
    // For lateness: minutes late > threshold
    threshold: Number,
    comparison: { type: String, enum: ['gt', 'lt', 'eq', 'gte', 'lte'] },

    // For safety: missing specific PPE
    requiredPPE: [String],

    // Time-based rules
    timeRange: {
      start: String,
      end: String
    }
  },

  // Fine amount (fixed or percentage of salary)
  amountType: { type: String, enum: ['fixed', 'percentage'] },
  amountValue: Number,

  // Recurrence
  maxPerDay: { type: Number, default: 1 },
  maxPerMonth: Number,

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  Fine: mongoose.model('Fine', FineSchema),
  FineRule: mongoose.model('FineRule', FineRuleSchema)
};
