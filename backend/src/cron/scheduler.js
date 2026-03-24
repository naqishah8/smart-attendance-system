const cron = require('node-cron');
const logger = require('../utils/logger');

function initScheduler() {
  logger.info('Initializing cron scheduler');

  // ── Every minute: Process scheduled notifications ──────────────
  cron.schedule('* * * * *', async () => {
    try {
      const NotificationService = require('../services/notification/NotificationService');
      const count = await NotificationService.processScheduled();
      if (count > 0) logger.info(`Cron: Delivered ${count} scheduled notifications`);
    } catch (err) {
      logger.error('Cron: Scheduled notification processing failed:', err.message);
    }
  });

  // ── Every day at 11:00 AM: Send absence prompts ────────────────
  // Checks who hasn't checked in by 11 AM and sends a push
  cron.schedule('0 11 * * 1-5', async () => {
    try {
      const Attendance = require('../models/Attendance');
      const User = require('../models/User');
      const NotificationService = require('../services/notification/NotificationService');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get active employees
      const employees = await User.find({ isActive: true, role: 'employee' }).select('_id');
      const employeeIds = employees.map(e => e._id);

      // Find who has checked in today
      const checkedIn = await Attendance.find({
        date: { $gte: today },
        userId: { $in: employeeIds },
        status: { $in: ['present', 'late', 'half-day'] }
      }).distinct('userId');

      const checkedInSet = new Set(checkedIn.map(id => id.toString()));

      // Send absence prompts to those who haven't checked in
      let sent = 0;
      for (const empId of employeeIds) {
        if (!checkedInSet.has(empId.toString())) {
          await NotificationService.sendAbsencePrompt(empId);
          sent++;
        }
      }

      if (sent > 0) logger.info(`Cron: Sent ${sent} absence prompts`);
    } catch (err) {
      logger.error('Cron: Absence prompt failed:', err.message);
    }
  });

  // ── Every Sunday at 2:00 AM: Run AI insights engine ────────────
  cron.schedule('0 2 * * 0', async () => {
    try {
      const InsightsEngine = require('../services/insights/InsightsEngine');
      const count = await InsightsEngine.runAnalysis();
      logger.info(`Cron: Insights engine generated ${count} new insights`);
    } catch (err) {
      logger.error('Cron: Insights engine failed:', err.message);
    }
  });

  // ── Every day at 3:00 AM: Adaptive face confidence check ───────
  cron.schedule('0 3 * * *', async () => {
    try {
      const AdaptiveFaceService = require('../services/ai/AdaptiveFaceService');
      const flagged = await AdaptiveFaceService.analyzeConfidenceTrends();
      if (flagged.length > 0) {
        logger.info(`Cron: Flagged ${flagged.length} users for face re-scan`);
      }
    } catch (err) {
      logger.error('Cron: Adaptive face check failed:', err.message);
    }
  });

  logger.info('Cron scheduler initialized with 4 jobs');
}

module.exports = initScheduler;
