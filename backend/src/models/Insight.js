const mongoose = require('mongoose');

const InsightSchema = new mongoose.Schema({
  // What the insight is about
  category: {
    type: String,
    enum: [
      'attendance-trend',    // day-of-week or seasonal patterns
      'department-anomaly',  // department-level issues
      'camera-performance',  // camera quality/reliability
      'overtime-alert',      // overtime spikes
      'shift-optimization',  // shift timing suggestions
      'attrition-risk',      // employee risk signals
      'fine-pattern',        // fine distribution issues
      'cost-saving',         // salary/resource optimization
      'engagement',          // morale/engagement signals
      'system-health'        // system performance insights
    ],
    required: true
  },

  // Human-readable insight
  title: { type: String, required: true },
  description: { type: String, required: true },
  suggestion: { type: String, required: true }, // actionable recommendation

  // Severity / importance
  impact: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  // Supporting data
  data: {
    metric: String,           // what was measured
    currentValue: Number,     // current state
    previousValue: Number,    // comparison baseline
    changePercent: Number,    // % change
    affectedCount: Number,    // how many employees/cameras affected
    department: String,       // if department-specific
    details: mongoose.Schema.Types.Mixed // any additional data
  },

  // Status
  status: {
    type: String,
    enum: ['new', 'acknowledged', 'acted-on', 'dismissed'],
    default: 'new'
  },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgedAt: Date,

  // Prevent duplicate insights
  fingerprint: { type: String, unique: true }, // hash of category + key data points

  // Analysis period
  periodStart: Date,
  periodEnd: Date,

  expiresAt: Date // auto-cleanup stale insights
}, {
  timestamps: true
});

InsightSchema.index({ category: 1, status: 1 });
InsightSchema.index({ impact: 1, createdAt: -1 });
InsightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
InsightSchema.index({ fingerprint: 1 });

module.exports = mongoose.model('Insight', InsightSchema);
