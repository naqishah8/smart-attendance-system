const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },

  // Attendance Rules
  attendance: {
    // Minutes after shift start to mark as "late" (0 = use shift grace period)
    lateAfterMinutes: { type: Number, default: 0, min: 0, max: 120 },

    // Minutes after shift start to auto-mark "absent" (default: 60)
    absentAfterMinutes: { type: Number, default: 60, min: 15, max: 480 },

    // Minutes after shift start to send "we missed you" notification
    missedNotificationAfterMinutes: { type: Number, default: 30, min: 5, max: 240 },

    // Minimum work hours for half-day (below this = absent)
    halfDayMinHours: { type: Number, default: 4, min: 1, max: 6 },

    // Auto-mark absent on weekends
    excludeWeekends: { type: Boolean, default: true },

    // Apply fines when auto-marking absent
    applyFinesOnAbsent: { type: Boolean, default: true },
  },

  // Notification Settings
  notifications: {
    // Send "we missed you" notification
    sendMissedNotification: { type: Boolean, default: true },

    // Custom message for missed notification
    missedNotificationTitle: { type: String, default: 'We missed you today!' },
    missedNotificationBody: { type: String, default: "It looks like you haven't checked in yet. Are you on leave, sick, or running late?" },

    // Send daily attendance summary to admin
    sendDailySummary: { type: Boolean, default: true },
    dailySummaryTime: { type: String, default: '18:00' }, // HH:MM

    // Slack/Teams webhooks
    slackWebhookUrl: { type: String, default: '' },
    teamsWebhookUrl: { type: String, default: '' },
  },

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Singleton pattern — only one settings document
SettingsSchema.statics.get = async function () {
  let settings = await this.findOne({ key: 'global' });
  if (!settings) {
    settings = await this.create({ key: 'global' });
  }
  return settings;
};

SettingsSchema.statics.update = async function (data, userId) {
  const settings = await this.get();
  if (data.attendance) Object.assign(settings.attendance, data.attendance);
  if (data.notifications) Object.assign(settings.notifications, data.notifications);
  settings.updatedBy = userId;
  await settings.save();
  return settings;
};

module.exports = mongoose.model('Settings', SettingsSchema);
