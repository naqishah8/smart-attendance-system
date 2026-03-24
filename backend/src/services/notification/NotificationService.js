const Notification = require('../../models/Notification');
const User = require('../../models/User');
const logger = require('../../utils/logger');
const axios = require('axios');

class NotificationService {
  /**
   * Create and optionally send a notification from admin
   */
  async createNotification({ createdBy, title, body, type = 'announcement', priority = 'normal',
    targetType, targetValue, scheduledAt }) {
    // Resolve recipients
    const recipients = await this._resolveRecipients(targetType, targetValue);

    const notification = await Notification.create({
      createdBy,
      title,
      body,
      type,
      priority,
      targetType,
      targetValue,
      recipients: recipients.map(r => r._id),
      scheduledAt: scheduledAt || null,
      status: scheduledAt ? 'scheduled' : 'sent',
      sentAt: scheduledAt ? null : new Date()
    });

    // If not scheduled, deliver immediately
    if (!scheduledAt) {
      await this._deliver(notification, recipients);
    }

    return notification;
  }

  /**
   * Send absence prompt to a specific employee
   */
  async sendAbsencePrompt(userId) {
    const user = await User.findById(userId);
    if (!user || !user.isActive) return null;

    // Check if we already sent one today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await Notification.findOne({
      type: 'absence-prompt',
      recipients: userId,
      createdAt: { $gte: today }
    });
    if (existing) return existing;

    const notification = await Notification.create({
      createdBy: userId, // system-generated, attributed to the user
      title: 'We missed you today!',
      body: 'It looks like you haven\'t checked in today. Are you on leave, sick, or did you forget to punch in?',
      type: 'absence-prompt',
      priority: 'normal',
      targetType: 'individual',
      targetValue: userId.toString(),
      recipients: [userId],
      status: 'sent',
      sentAt: new Date()
    });

    await this._deliver(notification, [user]);
    return notification;
  }

  /**
   * Record an employee's response to an absence prompt
   */
  async respondToAbsencePrompt(notificationId, userId, response, note) {
    const notification = await Notification.findById(notificationId);
    if (!notification || notification.type !== 'absence-prompt') {
      throw new Error('Invalid absence prompt');
    }

    notification.responses.push({ userId, response, note });
    await notification.save();
    return notification;
  }

  /**
   * Get notifications for a specific user
   */
  async getUserNotifications(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      Notification.find({
        recipients: userId,
        status: 'sent'
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName role'),
      Notification.countDocuments({ recipients: userId, status: 'sent' })
    ]);

    const unreadCount = await Notification.countDocuments({
      recipients: userId,
      status: 'sent',
      'readBy.userId': { $ne: userId }
    });

    return { notifications, total, unreadCount, page, limit };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    await Notification.updateOne(
      { _id: notificationId, 'readBy.userId': { $ne: userId } },
      { $push: { readBy: { userId, readAt: new Date() } } }
    );
  }

  /**
   * Get all notifications (admin view)
   */
  async getAllNotifications({ page = 1, limit = 20, type } = {}) {
    const skip = (page - 1) * limit;
    const query = {};
    if (type) query.type = type;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit)
        .populate('createdBy', 'firstName lastName'),
      Notification.countDocuments(query)
    ]);

    return { notifications, total, page, limit };
  }

  /**
   * Process scheduled notifications (called by cron)
   */
  async processScheduled() {
    const due = await Notification.find({
      status: 'scheduled',
      scheduledAt: { $lte: new Date() }
    }).populate('recipients', 'firstName lastName email');

    for (const notification of due) {
      try {
        await this._deliver(notification, notification.recipients);
        notification.status = 'sent';
        notification.sentAt = new Date();
        await notification.save();
      } catch (err) {
        logger.error(`Failed to deliver scheduled notification ${notification._id}:`, err);
        notification.status = 'failed';
        await notification.save();
      }
    }

    return due.length;
  }

  /**
   * Send to Slack webhook
   */
  async sendToSlack(webhookUrl, { title, body, priority }) {
    if (!webhookUrl) return;
    try {
      const emoji = priority === 'urgent' ? ':rotating_light:' : priority === 'high' ? ':warning:' : ':bell:';
      await axios.post(webhookUrl, {
        text: `${emoji} *${title}*\n${body}`
      }, { timeout: 5000 });
    } catch (err) {
      logger.error('Slack webhook failed:', err.message);
    }
  }

  /**
   * Send to Microsoft Teams webhook
   */
  async sendToTeams(webhookUrl, { title, body, priority }) {
    if (!webhookUrl) return;
    try {
      const color = priority === 'urgent' ? 'FF0000' : priority === 'high' ? 'FFA500' : '6C63FF';
      await axios.post(webhookUrl, {
        '@type': 'MessageCard',
        themeColor: color,
        summary: title,
        sections: [{
          activityTitle: title,
          text: body
        }]
      }, { timeout: 5000 });
    } catch (err) {
      logger.error('Teams webhook failed:', err.message);
    }
  }

  // ── Private ──────────────────────────────────────────────────────

  async _resolveRecipients(targetType, targetValue) {
    const filter = { isActive: true };
    switch (targetType) {
      case 'all':
        break;
      case 'department':
        filter.department = targetValue;
        break;
      case 'role':
        filter.role = targetValue;
        break;
      case 'individual':
        filter._id = targetValue;
        break;
      default:
        break;
    }
    return User.find(filter).select('_id firstName lastName email');
  }

  async _deliver(notification, recipients) {
    // Deliver via configured webhooks
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    const teamsUrl = process.env.TEAMS_WEBHOOK_URL;

    const promises = [];
    if (slackUrl) {
      promises.push(this.sendToSlack(slackUrl, notification));
    }
    if (teamsUrl) {
      promises.push(this.sendToTeams(teamsUrl, notification));
    }

    // Socket.IO real-time delivery (if available)
    try {
      const { io } = require('../../server');
      if (io) {
        for (const recipient of recipients) {
          const uid = recipient._id?.toString() || recipient.toString();
          io.to(uid).emit('notification', {
            id: notification._id,
            title: notification.title,
            body: notification.body,
            type: notification.type,
            priority: notification.priority,
            createdAt: notification.createdAt
          });
        }
      }
    } catch {
      // Socket.IO not available, skip
    }

    await Promise.allSettled(promises);
  }
}

module.exports = new NotificationService();
