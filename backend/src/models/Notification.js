const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  // Who sent it
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Targeting
  targetType: {
    type: String,
    enum: ['all', 'department', 'role', 'individual'],
    required: true
  },
  targetValue: String, // department name, role name, or userId
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Content
  title: { type: String, required: true, trim: true, maxlength: 200 },
  body: { type: String, required: true, trim: true, maxlength: 1000 },
  type: {
    type: String,
    enum: ['announcement', 'reminder', 'alert', 'absence-prompt', 'system', 'insight'],
    default: 'announcement'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Scheduling
  scheduledAt: Date, // null = send immediately
  sentAt: Date,
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sent', 'failed'],
    default: 'draft'
  },

  // Read tracking
  readBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],

  // Auto-prompt response (for absence prompts)
  responses: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    response: { type: String, enum: ['sick', 'leave', 'forgot', 'personal', 'other'] },
    note: String,
    respondedAt: { type: Date, default: Date.now }
  }],

  // Metadata
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

NotificationSchema.index({ status: 1, scheduledAt: 1 });
NotificationSchema.index({ 'recipients': 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
