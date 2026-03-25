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

  // ── Every 5 minutes (weekdays): Smart attendance check ─────────
  // Checks each employee's shift. If they haven't checked in:
  //   - After X minutes: send "we missed you" notification
  //   - After Y minutes: auto-mark absent
  // X and Y are configurable via admin Settings.
  cron.schedule('*/5 * * * 1-5', async () => {
    try {
      await runSmartAttendanceCheck();
    } catch (err) {
      logger.error('Cron: Smart attendance check failed:', err.message);
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

  // ── Every day at end of day: Mark remaining absent + daily summary
  cron.schedule('0 20 * * 1-5', async () => {
    try {
      await runEndOfDayAbsentMarking();
    } catch (err) {
      logger.error('Cron: End-of-day absent marking failed:', err.message);
    }
  });

  logger.info('Cron scheduler initialized with 5 jobs');
}

/**
 * Smart attendance check — runs every 5 minutes during work hours.
 * For each employee whose shift has started:
 *   - If no check-in and past "missedNotificationAfterMinutes" → send notification
 *   - If no check-in and past "absentAfterMinutes" → auto-mark absent
 */
async function runSmartAttendanceCheck() {
  const Settings = require('../models/Settings');
  const User = require('../models/User');
  const Attendance = require('../models/Attendance');
  const { Shift, UserShift } = require('../models/Shift');
  const NotificationService = require('../services/notification/NotificationService');
  const Notification = require('../models/Notification');
  const moment = require('moment');

  const settings = await Settings.get();
  const { absentAfterMinutes, missedNotificationAfterMinutes, excludeWeekends, applyFinesOnAbsent } = settings.attendance;
  const { sendMissedNotification, missedNotificationTitle, missedNotificationBody } = settings.notifications;

  const now = moment();
  const today = now.clone().startOf('day');

  // Skip weekends if configured
  if (excludeWeekends && (now.day() === 0 || now.day() === 6)) return;

  // Get all active employees
  const employees = await User.find({ isActive: true }).select('_id firstName lastName');

  // Get today's attendance records
  const attendanceRecords = await Attendance.find({
    date: { $gte: today.toDate(), $lt: today.clone().add(1, 'day').toDate() },
    status: { $in: ['present', 'late', 'half-day', 'leave', 'holiday'] }
  }).select('userId');
  const checkedInIds = new Set(attendanceRecords.map(a => a.userId.toString()));

  // Get today's absence-prompt notifications already sent
  const sentNotifs = await Notification.find({
    type: 'absence-prompt',
    createdAt: { $gte: today.toDate() }
  }).select('recipients');
  const notifiedIds = new Set();
  sentNotifs.forEach(n => n.recipients?.forEach(r => notifiedIds.add(r.toString())));

  // Get today's auto-marked absences
  const markedAbsent = await Attendance.find({
    date: { $gte: today.toDate(), $lt: today.clone().add(1, 'day').toDate() },
    status: 'absent'
  }).select('userId');
  const absentIds = new Set(markedAbsent.map(a => a.userId.toString()));

  let notifSent = 0;
  let absentMarked = 0;

  for (const emp of employees) {
    const empId = emp._id.toString();
    if (checkedInIds.has(empId)) continue; // Already checked in

    // Find employee's shift
    const userShift = await UserShift.findOne({
      userId: emp._id,
      effectiveFrom: { $lte: today.toDate() },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: today.toDate() } }]
    }).populate('shiftId');

    let shiftStartTime;
    if (userShift?.shiftId?.startTime) {
      const [h, m] = userShift.shiftId.startTime.split(':').map(Number);
      shiftStartTime = today.clone().hour(h).minute(m);
    } else {
      // Default shift: 9:00 AM
      shiftStartTime = today.clone().hour(9).minute(0);
    }

    const minutesSinceShiftStart = now.diff(shiftStartTime, 'minutes');

    // Skip if shift hasn't started yet
    if (minutesSinceShiftStart < 0) continue;

    // 1. Send "we missed you" notification
    if (sendMissedNotification &&
        minutesSinceShiftStart >= missedNotificationAfterMinutes &&
        !notifiedIds.has(empId) &&
        !absentIds.has(empId)) {
      try {
        await NotificationService.createNotification({
          createdBy: emp._id,
          title: missedNotificationTitle || 'We missed you today!',
          body: (missedNotificationBody || "It looks like you haven't checked in yet.")
            .replace('{name}', emp.firstName),
          type: 'absence-prompt',
          priority: 'normal',
          targetType: 'individual',
          targetValue: empId,
        });
        notifiedIds.add(empId);
        notifSent++;
      } catch (err) {
        logger.error(`Cron: Failed to send missed notification to ${emp.firstName}:`, err.message);
      }
    }

    // 2. Auto-mark absent
    if (minutesSinceShiftStart >= absentAfterMinutes && !absentIds.has(empId)) {
      try {
        await Attendance.updateOne(
          { userId: emp._id, date: today.toDate() },
          { $setOnInsert: { userId: emp._id, date: today.toDate(), status: 'absent', createdAt: new Date(), updatedAt: new Date() } },
          { upsert: true }
        );
        absentIds.add(empId);
        absentMarked++;

        // Apply fines if enabled
        if (applyFinesOnAbsent) {
          try {
            const FineService = require('../services/finance/FineService');
            await FineService.applyAbsentFine(emp._id, today.toDate());
          } catch { /* fine may not apply if no rule exists */ }
        }
      } catch (err) {
        logger.error(`Cron: Failed to mark absent for ${emp.firstName}:`, err.message);
      }
    }
  }

  if (notifSent > 0 || absentMarked > 0) {
    logger.info(`Cron: Smart check — ${notifSent} notifications sent, ${absentMarked} marked absent`);
  }
}

/**
 * End of day: mark any remaining employees without attendance as absent.
 */
async function runEndOfDayAbsentMarking() {
  const Settings = require('../models/Settings');
  const User = require('../models/User');
  const Attendance = require('../models/Attendance');
  const moment = require('moment');

  const settings = await Settings.get();
  if (settings.attendance.excludeWeekends) {
    const day = moment().day();
    if (day === 0 || day === 6) return;
  }

  const today = moment().startOf('day');
  const employees = await User.find({ isActive: true }).select('_id');
  const existing = await Attendance.find({
    date: { $gte: today.toDate(), $lt: today.clone().add(1, 'day').toDate() }
  }).select('userId');
  const existingIds = new Set(existing.map(a => a.userId.toString()));

  const toMark = employees.filter(e => !existingIds.has(e._id.toString()));

  if (toMark.length > 0) {
    const records = toMark.map(e => ({
      userId: e._id,
      date: today.toDate(),
      status: 'absent',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await Attendance.insertMany(records, { ordered: false }).catch(() => {});
    logger.info(`Cron: End-of-day marked ${toMark.length} employees absent`);
  }
}

module.exports = initScheduler;
