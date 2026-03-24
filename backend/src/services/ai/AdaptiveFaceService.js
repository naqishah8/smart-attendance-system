const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const NotificationService = require('../notification/NotificationService');
const logger = require('../../utils/logger');

const CONFIDENCE_THRESHOLD = 0.65;      // flag if avg drops below this
const LOOKBACK_DAYS = 14;               // analyze last 14 days
const MIN_DETECTIONS = 5;               // need at least 5 detections to assess

class AdaptiveFaceService {
  /**
   * Analyze all users' face match confidence trends.
   * Called by cron (daily). Flags users for re-scan if confidence is decaying.
   */
  async analyzeConfidenceTrends() {
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);

    const userStats = await Attendance.aggregate([
      { $match: { date: { $gte: since } } },
      { $unwind: '$detections' },
      { $match: { 'detections.confidence': { $exists: true, $gt: 0 } } },
      { $group: {
        _id: '$userId',
        avgConfidence: { $avg: '$detections.confidence' },
        minConfidence: { $min: '$detections.confidence' },
        maxConfidence: { $max: '$detections.confidence' },
        count: { $sum: 1 },
        recentAvg: {
          $avg: {
            $cond: [
              { $gte: ['$detections.timestamp', new Date(Date.now() - 7 * 86400000)] },
              '$detections.confidence',
              null
            ]
          }
        }
      }},
      { $match: { count: { $gte: MIN_DETECTIONS } } }
    ]);

    const flagged = [];

    for (const stat of userStats) {
      // Check if average confidence is below threshold
      if (stat.avgConfidence < CONFIDENCE_THRESHOLD) {
        flagged.push({ userId: stat._id, reason: 'low_average', avgConfidence: stat.avgConfidence });
        continue;
      }

      // Check for declining trend (recent 7d vs full 14d)
      if (stat.recentAvg && stat.avgConfidence > 0) {
        const decline = (stat.avgConfidence - stat.recentAvg) / stat.avgConfidence;
        if (decline > 0.15) { // 15%+ decline
          flagged.push({ userId: stat._id, reason: 'declining', avgConfidence: stat.avgConfidence, recentAvg: stat.recentAvg });
        }
      }
    }

    // Notify flagged users
    for (const flag of flagged) {
      try {
        const user = await User.findById(flag.userId);
        if (!user || !user.isActive) continue;

        await NotificationService.createNotification({
          createdBy: flag.userId,
          title: 'Face recognition update needed',
          body: `Your face recognition accuracy has dropped to ${(flag.avgConfidence * 100).toFixed(0)}%. Please visit your admin to update your face scan for better check-in experience.`,
          type: 'system',
          priority: 'normal',
          targetType: 'individual',
          targetValue: flag.userId.toString()
        });

        logger.info(`AdaptiveFace: Flagged ${user.firstName} ${user.lastName} for re-scan (${flag.reason}, confidence: ${(flag.avgConfidence * 100).toFixed(0)}%)`);
      } catch (err) {
        logger.error(`AdaptiveFace: Failed to notify user ${flag.userId}:`, err.message);
      }
    }

    logger.info(`AdaptiveFace: Analyzed ${userStats.length} users, flagged ${flagged.length} for re-scan`);
    return flagged;
  }

  /**
   * Get confidence stats for a specific user
   */
  async getUserConfidenceStats(userId) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const stats = await Attendance.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(userId), date: { $gte: since } } },
      { $unwind: '$detections' },
      { $match: { 'detections.confidence': { $exists: true, $gt: 0 } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        avgConfidence: { $avg: '$detections.confidence' },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    const overall = stats.length > 0
      ? stats.reduce((s, d) => s + d.avgConfidence, 0) / stats.length
      : null;

    return {
      dailyStats: stats,
      overallAvg: overall,
      needsRescan: overall !== null && overall < CONFIDENCE_THRESHOLD,
      totalDetections: stats.reduce((s, d) => s + d.count, 0)
    };
  }
}

module.exports = new AdaptiveFaceService();
