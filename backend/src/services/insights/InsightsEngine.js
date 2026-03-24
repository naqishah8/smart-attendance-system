const crypto = require('crypto');
const Insight = require('../../models/Insight');
const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const Camera = require('../../models/Camera');
const { Fine } = require('../../models/Fine');
const { Salary } = require('../../models/Salary');
const { Shift } = require('../../models/Shift');
const moment = require('moment');
const logger = require('../../utils/logger');

class InsightsEngine {
  constructor() {
    this.analyzers = [
      this.analyzeAttendanceTrends,
      this.analyzeDepartmentAnomalies,
      this.analyzeCameraPerformance,
      this.analyzeOvertimePatterns,
      this.analyzeShiftOptimization,
      this.analyzeAttritionSignals,
      this.analyzeFinePatterns,
      this.analyzeEngagement,
    ];
  }

  /**
   * Run all analyzers and generate insights. Called by cron (weekly).
   */
  async runAnalysis() {
    logger.info('InsightsEngine: Starting analysis cycle');
    const insights = [];

    for (const analyzer of this.analyzers) {
      try {
        const result = await analyzer.call(this);
        if (result && result.length > 0) {
          insights.push(...result);
        }
      } catch (err) {
        logger.error(`InsightsEngine: Analyzer failed - ${err.message}`);
      }
    }

    // Deduplicate and save
    let saved = 0;
    for (const insight of insights) {
      try {
        const fp = this._fingerprint(insight);
        const existing = await Insight.findOne({ fingerprint: fp });
        if (!existing) {
          await Insight.create({ ...insight, fingerprint: fp, expiresAt: moment().add(30, 'days').toDate() });
          saved++;
        }
      } catch (err) {
        if (err.code !== 11000) { // ignore duplicate key
          logger.error('InsightsEngine: Failed to save insight:', err.message);
        }
      }
    }

    logger.info(`InsightsEngine: Analysis complete. ${saved} new insights generated.`);
    return saved;
  }

  /**
   * Analyze day-of-week attendance patterns
   */
  async analyzeAttendanceTrends() {
    const insights = [];
    const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

    const dayStats = await Attendance.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: { $dayOfWeek: '$date' },
        total: { $sum: 1 },
        lateCount: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        avgHours: { $avg: '$effectiveWorkHours' }
      }},
      { $sort: { _id: 1 } }
    ]);

    if (dayStats.length < 3) return insights;

    const dayNames = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const avgLateRate = dayStats.reduce((s, d) => s + (d.total > 0 ? d.lateCount / d.total : 0), 0) / dayStats.length;

    for (const day of dayStats) {
      if (day.total === 0) continue;
      const lateRate = day.lateCount / day.total;
      if (lateRate > avgLateRate * 1.5 && lateRate > 0.2) {
        insights.push({
          category: 'attendance-trend',
          title: `High late arrivals on ${dayNames[day._id]}s`,
          description: `${(lateRate * 100).toFixed(0)}% of employees arrive late on ${dayNames[day._id]}s, compared to the average of ${(avgLateRate * 100).toFixed(0)}%.`,
          suggestion: `Consider adjusting the start time or extending the grace period on ${dayNames[day._id]}s.`,
          impact: lateRate > 0.4 ? 'high' : 'medium',
          data: {
            metric: 'late_rate_by_day',
            currentValue: lateRate,
            previousValue: avgLateRate,
            changePercent: ((lateRate - avgLateRate) / avgLateRate * 100),
            details: { dayOfWeek: day._id, dayName: dayNames[day._id] }
          },
          periodStart: thirtyDaysAgo,
          periodEnd: new Date()
        });
      }

      // Low work hours day
      const avgAllDays = dayStats.reduce((s, d) => s + (d.avgHours || 0), 0) / dayStats.length;
      if (day.avgHours && day.avgHours < avgAllDays * 0.85 && avgAllDays > 0) {
        insights.push({
          category: 'attendance-trend',
          title: `Low productivity on ${dayNames[day._id]}s`,
          description: `Average work hours on ${dayNames[day._id]}s is ${day.avgHours.toFixed(1)}h, ${((1 - day.avgHours / avgAllDays) * 100).toFixed(0)}% below the weekly average of ${avgAllDays.toFixed(1)}h.`,
          suggestion: `Review ${dayNames[day._id]} schedules. Consider team activities or flexible timing to boost engagement.`,
          impact: 'medium',
          data: {
            metric: 'avg_hours_by_day',
            currentValue: day.avgHours,
            previousValue: avgAllDays,
            changePercent: ((day.avgHours - avgAllDays) / avgAllDays * 100),
            details: { dayOfWeek: day._id }
          },
          periodStart: thirtyDaysAgo,
          periodEnd: new Date()
        });
      }
    }

    return insights;
  }

  /**
   * Analyze department-level anomalies
   */
  async analyzeDepartmentAnomalies() {
    const insights = [];
    const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

    // Get department attendance rates
    const deptStats = await Attendance.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo } } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $group: {
        _id: '$user.department',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
        lateCount: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        avgHours: { $avg: '$effectiveWorkHours' }
      }},
      { $match: { total: { $gte: 10 } } } // only departments with enough data
    ]);

    if (deptStats.length < 2) return insights;

    const overallAttendanceRate = deptStats.reduce((s, d) => s + d.present, 0) / deptStats.reduce((s, d) => s + d.total, 0);

    for (const dept of deptStats) {
      const attendanceRate = dept.present / dept.total;

      // Department with significantly low attendance
      if (attendanceRate < overallAttendanceRate * 0.85 && attendanceRate < 0.85) {
        insights.push({
          category: 'department-anomaly',
          title: `Low attendance in ${dept._id}`,
          description: `${dept._id} department has ${(attendanceRate * 100).toFixed(0)}% attendance rate, well below the company average of ${(overallAttendanceRate * 100).toFixed(0)}%.`,
          suggestion: `Investigate workload, team morale, or management issues in ${dept._id}. Consider a team check-in.`,
          impact: attendanceRate < 0.7 ? 'high' : 'medium',
          data: {
            metric: 'dept_attendance_rate',
            currentValue: attendanceRate,
            previousValue: overallAttendanceRate,
            changePercent: ((attendanceRate - overallAttendanceRate) / overallAttendanceRate * 100),
            department: dept._id,
            affectedCount: dept.absentCount
          },
          periodStart: thirtyDaysAgo,
          periodEnd: new Date()
        });
      }

      // High late rate in department
      const lateRate = dept.lateCount / dept.total;
      if (lateRate > 0.3) {
        insights.push({
          category: 'department-anomaly',
          title: `Frequent lateness in ${dept._id}`,
          description: `${(lateRate * 100).toFixed(0)}% of ${dept._id} records show late arrivals.`,
          suggestion: `Review shift timings for ${dept._id} or discuss commute challenges with the team.`,
          impact: lateRate > 0.5 ? 'high' : 'medium',
          data: {
            metric: 'dept_late_rate',
            currentValue: lateRate,
            department: dept._id,
            affectedCount: dept.lateCount
          },
          periodStart: thirtyDaysAgo,
          periodEnd: new Date()
        });
      }
    }

    return insights;
  }

  /**
   * Analyze camera reliability and detection quality
   */
  async analyzeCameraPerformance() {
    const insights = [];
    const sevenDaysAgo = moment().subtract(7, 'days').toDate();

    const cameras = await Camera.find({});
    if (cameras.length === 0) return insights;

    // Check detection confidence per camera
    const cameraStats = await Attendance.aggregate([
      { $match: { date: { $gte: sevenDaysAgo } } },
      { $unwind: '$detections' },
      { $group: {
        _id: '$detections.cameraId',
        avgConfidence: { $avg: '$detections.confidence' },
        detectionCount: { $sum: 1 },
        lowConfidenceCount: { $sum: { $cond: [{ $lt: ['$detections.confidence', 0.7] }, 1, 0] } }
      }}
    ]);

    for (const stat of cameraStats) {
      const camera = cameras.find(c => c._id.toString() === stat._id);
      if (!camera) continue;

      // Low average confidence
      if (stat.avgConfidence && stat.avgConfidence < 0.75 && stat.detectionCount > 5) {
        insights.push({
          category: 'camera-performance',
          title: `Low detection quality on ${camera.name}`,
          description: `Camera "${camera.name}" has an average face confidence of ${(stat.avgConfidence * 100).toFixed(0)}% (${stat.lowConfidenceCount} low-confidence detections out of ${stat.detectionCount}).`,
          suggestion: `Check camera positioning, lighting, and lens cleanliness. Consider upgrading resolution from ${camera.resolution || 'unknown'}.`,
          impact: stat.avgConfidence < 0.6 ? 'high' : 'medium',
          data: {
            metric: 'camera_confidence',
            currentValue: stat.avgConfidence,
            affectedCount: stat.lowConfidenceCount,
            details: { cameraId: stat._id, cameraName: camera.name }
          },
          periodStart: sevenDaysAgo,
          periodEnd: new Date()
        });
      }
    }

    // Offline cameras
    const offlineCameras = cameras.filter(c => c.status === 'offline');
    if (offlineCameras.length > 0 && offlineCameras.length >= cameras.length * 0.5) {
      insights.push({
        category: 'camera-performance',
        title: `${offlineCameras.length} of ${cameras.length} cameras offline`,
        description: `More than half of your cameras are currently offline: ${offlineCameras.map(c => c.name).join(', ')}.`,
        suggestion: `Check network connectivity and camera power. Offline cameras mean missed attendance detections.`,
        impact: 'critical',
        data: {
          metric: 'cameras_offline',
          currentValue: offlineCameras.length,
          previousValue: cameras.length,
          affectedCount: offlineCameras.length
        },
        periodStart: new Date(),
        periodEnd: new Date()
      });
    }

    return insights;
  }

  /**
   * Detect overtime spikes
   */
  async analyzeOvertimePatterns() {
    const insights = [];
    const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
    const sixtyDaysAgo = moment().subtract(60, 'days').toDate();

    // Compare last 30 days vs previous 30 days
    const [recent, previous] = await Promise.all([
      Attendance.aggregate([
        { $match: { date: { $gte: thirtyDaysAgo }, 'shiftCompliance.overtimeHours': { $gt: 0 } } },
        { $group: { _id: null, totalOT: { $sum: '$shiftCompliance.overtimeHours' }, count: { $sum: 1 } } }
      ]),
      Attendance.aggregate([
        { $match: { date: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }, 'shiftCompliance.overtimeHours': { $gt: 0 } } },
        { $group: { _id: null, totalOT: { $sum: '$shiftCompliance.overtimeHours' }, count: { $sum: 1 } } }
      ])
    ]);

    const recentOT = recent[0]?.totalOT || 0;
    const previousOT = previous[0]?.totalOT || 0;

    if (previousOT > 0 && recentOT > previousOT * 1.3 && recentOT > 20) {
      const increase = ((recentOT - previousOT) / previousOT * 100).toFixed(0);
      insights.push({
        category: 'overtime-alert',
        title: `Overtime increased by ${increase}%`,
        description: `Total overtime hours jumped from ${previousOT.toFixed(0)}h to ${recentOT.toFixed(0)}h compared to the previous period.`,
        suggestion: `Review workload distribution. Consider hiring or redistributing tasks to prevent burnout.`,
        impact: recentOT > previousOT * 2 ? 'high' : 'medium',
        data: {
          metric: 'total_overtime_hours',
          currentValue: recentOT,
          previousValue: previousOT,
          changePercent: Number(increase)
        },
        periodStart: thirtyDaysAgo,
        periodEnd: new Date()
      });
    }

    // Per-employee overtime burnout risk
    const employeeOT = await Attendance.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo }, 'shiftCompliance.overtimeHours': { $gt: 0 } } },
      { $group: {
        _id: '$userId',
        totalOT: { $sum: '$shiftCompliance.overtimeHours' },
        days: { $sum: 1 }
      }},
      { $match: { totalOT: { $gt: 20 } } }, // more than 20h OT in a month
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' }
    ]);

    if (employeeOT.length > 0) {
      insights.push({
        category: 'overtime-alert',
        title: `${employeeOT.length} employees with excessive overtime`,
        description: `These employees logged 20+ overtime hours this month: ${employeeOT.map(e => `${e.user.firstName} ${e.user.lastName} (${e.totalOT.toFixed(0)}h)`).join(', ')}.`,
        suggestion: `Check for burnout risk. Consider mandatory rest days or workload redistribution.`,
        impact: 'high',
        data: {
          metric: 'excessive_overtime_employees',
          currentValue: employeeOT.length,
          affectedCount: employeeOT.length,
          details: { employees: employeeOT.map(e => ({ name: `${e.user.firstName} ${e.user.lastName}`, hours: e.totalOT })) }
        },
        periodStart: thirtyDaysAgo,
        periodEnd: new Date()
      });
    }

    return insights;
  }

  /**
   * Suggest shift timing adjustments based on actual check-in patterns
   */
  async analyzeShiftOptimization() {
    const insights = [];
    const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

    // Find peak check-in times
    const checkInTimes = await Attendance.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo }, firstDetection: { $exists: true } } },
      { $project: { hour: { $hour: '$firstDetection' }, minute: { $minute: '$firstDetection' } } },
      { $group: {
        _id: '$hour',
        count: { $sum: 1 },
        avgMinute: { $avg: '$minute' }
      }},
      { $sort: { count: -1 } }
    ]);

    if (checkInTimes.length === 0) return insights;

    const peakHour = checkInTimes[0];
    const shifts = await Shift.find({});

    for (const shift of shifts) {
      if (!shift.startTime) continue;
      const shiftHour = parseInt(shift.startTime.split(':')[0]);

      // If most people check in 30+ mins before shift starts
      if (peakHour._id < shiftHour && (shiftHour - peakHour._id) >= 1) {
        insights.push({
          category: 'shift-optimization',
          title: `Employees arrive earlier than shift "${shift.name}"`,
          description: `Most check-ins happen around ${peakHour._id}:${Math.round(peakHour.avgMinute || 0).toString().padStart(2, '0')}, but shift "${shift.name}" starts at ${shift.startTime}.`,
          suggestion: `Consider starting the shift earlier to match natural arrival patterns, or offer flexible start windows.`,
          impact: 'low',
          data: {
            metric: 'peak_checkin_vs_shift',
            currentValue: peakHour._id,
            previousValue: shiftHour,
            details: { shiftName: shift.name, peakCount: peakHour.count }
          },
          periodStart: thirtyDaysAgo,
          periodEnd: new Date()
        });
      }
    }

    // Grace period suggestion
    const lateByMinutes = await Attendance.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo }, 'shiftCompliance.wasLate': true } },
      { $group: {
        _id: null,
        avgLateMinutes: { $avg: '$shiftCompliance.lateMinutes' },
        count: { $sum: 1 },
        under5: { $sum: { $cond: [{ $lte: ['$shiftCompliance.lateMinutes', 5] }, 1, 0] } }
      }}
    ]);

    if (lateByMinutes.length > 0 && lateByMinutes[0].count > 0) {
      const data = lateByMinutes[0];
      const trivialLatePercent = data.under5 / data.count;

      if (trivialLatePercent > 0.5) {
        insights.push({
          category: 'shift-optimization',
          title: `${(trivialLatePercent * 100).toFixed(0)}% of "late" arrivals are under 5 minutes`,
          description: `Most late arrivals are trivial (under 5 mins). Average late time is ${data.avgLateMinutes.toFixed(0)} minutes.`,
          suggestion: `Consider increasing the grace period by 5 minutes to reduce unnecessary late marks and improve employee morale.`,
          impact: 'medium',
          data: {
            metric: 'trivial_late_percentage',
            currentValue: trivialLatePercent,
            affectedCount: data.under5,
            details: { avgLateMinutes: data.avgLateMinutes, totalLateRecords: data.count }
          },
          periodStart: thirtyDaysAgo,
          periodEnd: new Date()
        });
      }
    }

    return insights;
  }

  /**
   * Detect attrition risk signals
   */
  async analyzeAttritionSignals() {
    const insights = [];
    const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
    const sixtyDaysAgo = moment().subtract(60, 'days').toDate();

    // Employees with declining attendance
    const employees = await User.find({ isActive: true }).select('_id firstName lastName department');

    const atRisk = [];
    for (const emp of employees) {
      const [recent, previous] = await Promise.all([
        Attendance.countDocuments({ userId: emp._id, date: { $gte: thirtyDaysAgo }, status: { $in: ['present', 'late'] } }),
        Attendance.countDocuments({ userId: emp._id, date: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }, status: { $in: ['present', 'late'] } })
      ]);

      if (previous > 5 && recent < previous * 0.7) {
        atRisk.push({
          name: `${emp.firstName} ${emp.lastName}`,
          department: emp.department,
          recentDays: recent,
          previousDays: previous,
          decline: ((1 - recent / previous) * 100).toFixed(0)
        });
      }
    }

    if (atRisk.length > 0) {
      insights.push({
        category: 'attrition-risk',
        title: `${atRisk.length} employees showing attendance decline`,
        description: `These employees have 30%+ attendance drop compared to the previous month: ${atRisk.map(e => `${e.name} (-${e.decline}%)`).join(', ')}.`,
        suggestion: `Schedule one-on-one check-ins. Attendance decline is a leading indicator of disengagement or burnout.`,
        impact: atRisk.length > 3 ? 'high' : 'medium',
        data: {
          metric: 'attendance_decline_employees',
          currentValue: atRisk.length,
          affectedCount: atRisk.length,
          details: { employees: atRisk }
        },
        periodStart: thirtyDaysAgo,
        periodEnd: new Date()
      });
    }

    return insights;
  }

  /**
   * Analyze fine distribution for fairness
   */
  async analyzeFinePatterns() {
    const insights = [];
    const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

    const fineStats = await Fine.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: 'applied' } },
      { $group: {
        _id: '$type.category',
        total: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        disputeCount: { $sum: { $cond: [{ $eq: ['$status', 'disputed'] }, 1, 0] } }
      }}
    ]);

    const totalFines = fineStats.reduce((s, f) => s + f.total, 0);

    for (const stat of fineStats) {
      // If one category dominates >60% of all fines
      if (totalFines > 10 && stat.total / totalFines > 0.6) {
        insights.push({
          category: 'fine-pattern',
          title: `"${stat._id}" fines dominate at ${(stat.total / totalFines * 100).toFixed(0)}%`,
          description: `${stat.total} out of ${totalFines} fines are for "${stat._id}", totaling $${stat.totalAmount.toFixed(0)}.`,
          suggestion: `The "${stat._id}" rule may be too strict, or there's a systemic issue to address rather than fine individually.`,
          impact: 'medium',
          data: {
            metric: 'fine_category_concentration',
            currentValue: stat.total / totalFines,
            affectedCount: stat.total,
            details: { category: stat._id, amount: stat.totalAmount }
          },
          periodStart: thirtyDaysAgo,
          periodEnd: new Date()
        });
      }
    }

    return insights;
  }

  /**
   * Analyze engagement signals from emotion and work hour data
   */
  async analyzeEngagement() {
    const insights = [];
    const fourteenDaysAgo = moment().subtract(14, 'days').toDate();

    // Emotion analysis
    const emotionStats = await Attendance.aggregate([
      { $match: { date: { $gte: fourteenDaysAgo } } },
      { $unwind: '$detections' },
      { $match: { 'detections.emotion': { $exists: true } } },
      { $group: {
        _id: '$detections.emotion',
        count: { $sum: 1 }
      }}
    ]);

    const totalEmotions = emotionStats.reduce((s, e) => s + e.count, 0);
    if (totalEmotions > 20) {
      const stressed = emotionStats.find(e => e._id === 'stressed');
      const fatigued = emotionStats.find(e => e._id === 'fatigued');
      const negativeCount = (stressed?.count || 0) + (fatigued?.count || 0);
      const negativeRate = negativeCount / totalEmotions;

      if (negativeRate > 0.3) {
        insights.push({
          category: 'engagement',
          title: `${(negativeRate * 100).toFixed(0)}% of detected emotions are negative`,
          description: `High levels of stress (${stressed?.count || 0}) and fatigue (${fatigued?.count || 0}) detected across the workforce.`,
          suggestion: `Consider wellness initiatives, workload review, or team-building activities. High stress correlates with turnover.`,
          impact: negativeRate > 0.5 ? 'high' : 'medium',
          data: {
            metric: 'negative_emotion_rate',
            currentValue: negativeRate,
            affectedCount: negativeCount,
            details: { emotions: Object.fromEntries(emotionStats.map(e => [e._id, e.count])) }
          },
          periodStart: fourteenDaysAgo,
          periodEnd: new Date()
        });
      }
    }

    return insights;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  _fingerprint(insight) {
    const key = `${insight.category}:${insight.data?.metric}:${insight.data?.department || ''}:${moment().format('YYYY-WW')}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }
}

module.exports = new InsightsEngine();
