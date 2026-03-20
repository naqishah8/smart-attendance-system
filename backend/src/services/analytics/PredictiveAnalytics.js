const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const { Fine } = require('../../models/Fine');
const moment = require('moment');
const logger = require('../../utils/logger');

class PredictiveAnalytics {
  async analyzeAttritionRisk() {
    try {
      const users = await User.find({ isActive: true });
      const risks = [];

      for (const user of users) {
        try {
          const risk = await this.calculateAttritionRisk(user._id);
          if (risk.score > 0.7) {
            risks.push({
              userId: user._id,
              name: `${user.firstName} ${user.lastName}`,
              department: user.department,
              score: risk.score,
              factors: risk.factors,
              recommendedAction: risk.recommendedAction
            });
          }
        } catch (err) {
          logger.error(`Error calculating attrition risk for user ${user._id}:`, err);
        }
      }

      return risks.sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.error('Error in analyzeAttritionRisk:', error);
      throw error;
    }
  }

  async calculateAttritionRisk(userId) {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }

      const threeMonthsAgo = moment().subtract(3, 'months').toDate();

      // Get attendance for last 3 months
      const attendances = await Attendance.find({
        userId,
        date: { $gte: threeMonthsAgo }
      }).sort({ date: -1 });

      // Get fines for last 3 months
      const fines = await Fine.find({
        userId,
        createdAt: { $gte: threeMonthsAgo }
      });

      const factors = [];
      let riskScore = 0;

      // Factor 1: Decreasing attendance trend
      const monthlyAttendance = this.calculateMonthlyAttendance(attendances);
      if (monthlyAttendance.length >= 2) {
        const trend = monthlyAttendance[0].rate - monthlyAttendance[1].rate;
        if (trend < -10) { // 10% drop
          riskScore += 0.3;
          factors.push('Significant drop in attendance');
        }
      }

      // Factor 2: Increasing lateness
      const lateCount = attendances.filter(a => a.status === 'late').length;
      const lateRate = attendances.length > 0 ? lateCount / attendances.length : 0;
      if (lateRate > 0.3) { // Late more than 30% of time
        riskScore += 0.2;
        factors.push('High rate of lateness');
      }

      // Factor 3: Increasing fines
      const fineCount = fines.length;
      const avgFinesPerMonth = fineCount / 3;
      if (avgFinesPerMonth > 2) {
        riskScore += 0.2;
        factors.push('Multiple fines recently');
      }

      // Factor 4: Decreasing work hours
      const avgHours = attendances.length > 0
        ? attendances.reduce((sum, a) => sum + (a.effectiveWorkHours || 0), 0) / attendances.length
        : 0;
      if (avgHours > 0 && avgHours < 6) { // Assuming 8-hour day
        riskScore += 0.15;
        factors.push('Working reduced hours');
      }

      // Factor 5: PPE compliance drop — add null/empty check on detections
      const ppeViolations = attendances.filter(a => {
        const detections = a.detections;
        if (!detections || detections.length === 0) return false;
        return detections.some(d =>
          d.ppeCompliance && (!d.ppeCompliance.helmet || !d.ppeCompliance.vest)
        );
      }).length;
      if (attendances.length > 0 && ppeViolations / attendances.length > 0.2) {
        riskScore += 0.15;
        factors.push('Increased safety violations');
      }

      // Recommend action based on risk factors
      let recommendedAction = 'Monitor situation';
      if (riskScore > 0.8) {
        recommendedAction = 'Schedule immediate one-on-one meeting';
      } else if (riskScore > 0.6) {
        recommendedAction = 'Send wellness check-in';
      }

      return {
        score: Math.min(riskScore, 1.0),
        factors,
        recommendedAction
      };
    } catch (error) {
      logger.error('Error in calculateAttritionRisk:', error);
      throw error;
    }
  }

  calculateMonthlyAttendance(attendances) {
    const monthly = {};

    attendances.forEach(a => {
      const month = moment(a.date).format('YYYY-MM');
      if (!monthly[month]) {
        monthly[month] = { total: 0, present: 0 };
      }
      monthly[month].total++;
      if (a.status !== 'absent') {
        monthly[month].present++;
      }
    });

    return Object.keys(monthly).map(month => ({
      month,
      rate: monthly[month].total > 0
        ? (monthly[month].present / monthly[month].total) * 100
        : 0
    })).sort((a, b) => b.month.localeCompare(a.month));
  }

  async predictAttendance(date) {
    try {
      if (!date) {
        throw new Error('date is required');
      }

      // Predict how many people will be absent on a given date
      const historicalData = await Attendance.aggregate([
        {
          $match: {
            date: {
              $gte: moment(date).subtract(1, 'year').toDate(),
              $lt: date
            }
          }
        },
        {
          $group: {
            _id: { $dayOfWeek: '$date' },
            total: { $sum: 1 },
            absent: {
              $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
            }
          }
        }
      ]);

      const dayOfWeek = moment(date).day();
      // Null check on historicalData.find() result
      const dayData = historicalData && historicalData.length > 0
        ? historicalData.find(d => d._id === dayOfWeek + 1)
        : null;

      if (!dayData || !dayData.total || dayData.total === 0) {
        return {
          predictedAbsenteeism: 10, // Default 10%
          confidence: 0.5
        };
      }

      const absenteeRate = (dayData.absent / dayData.total) * 100;

      return {
        predictedAbsenteeism: absenteeRate.toFixed(1),
        confidence: 0.8,
        basedOn: dayData.total,
        recommendation: absenteeRate > 15
          ? 'Consider scheduling extra staff'
          : 'Normal staffing should suffice'
      };
    } catch (error) {
      logger.error('Error in predictAttendance:', error);
      throw error;
    }
  }

  async detectAnomalies(userId, date) {
    try {
      if (!userId || !date) {
        throw new Error('userId and date are required');
      }

      // Detect unusual behavior patterns
      const attendance = await Attendance.findOne({ userId, date });

      if (!attendance) return [];

      const anomalies = [];

      // Check for unusually late arrival
      if (attendance.shiftCompliance?.lateMinutes > 60) {
        anomalies.push({
          type: 'extreme_lateness',
          severity: 'high',
          description: `Arrived ${attendance.shiftCompliance.lateMinutes} minutes late`
        });
      }

      // Check for unusually short day
      if (attendance.effectiveWorkHours && attendance.effectiveWorkHours < 4) {
        anomalies.push({
          type: 'short_day',
          severity: 'medium',
          description: `Worked only ${attendance.effectiveWorkHours.toFixed(1)} hours`
        });
      }

      // Check for unusual break patterns
      if (attendance.breakHours && attendance.breakHours > 3) {
        anomalies.push({
          type: 'excessive_breaks',
          severity: 'medium',
          description: `Took ${attendance.breakHours.toFixed(1)} hours of breaks`
        });
      }

      // Null/empty check on detections before filtering
      const detections = attendance.detections;
      if (detections && detections.length > 0) {
        // Check for multiple PPE violations in one day
        const ppeViolations = detections.filter(d =>
          d.ppeCompliance && (!d.ppeCompliance.helmet || !d.ppeCompliance.vest ||
            !d.ppeCompliance.goggles || !d.ppeCompliance.gloves)
        ).length;

        if (ppeViolations > 3) {
          anomalies.push({
            type: 'repeated_safety_violations',
            severity: 'high',
            description: `${ppeViolations} PPE violations today`
          });
        }

        // Check for fatigue indicators
        const fatiguedDetections = detections.filter(
          d => d.emotion === 'fatigued'
        ).length;

        if (fatiguedDetections > 5) {
          anomalies.push({
            type: 'fatigue_detected',
            severity: 'medium',
            description: `Employee appears fatigued (${fatiguedDetections} detections)`
          });
        }
      }

      return anomalies;
    } catch (error) {
      logger.error('Error in detectAnomalies:', error);
      throw error;
    }
  }

  async getDepartmentInsights() {
    try {
      const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

      // Use aggregation pipeline instead of N+1 queries
      const [attendanceAgg, fineAgg, users] = await Promise.all([
        // Aggregate attendance data per user
        Attendance.aggregate([
          { $match: { date: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: '$userId',
              totalDays: { $sum: 1 },
              presentDays: {
                $sum: { $cond: [{ $ne: ['$status', 'absent'] }, 1, 0] }
              },
              totalWorkHours: {
                $sum: { $ifNull: ['$effectiveWorkHours', 0] }
              }
            }
          }
        ]),
        // Aggregate fines per user
        Fine.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: '$userId',
              totalFines: { $sum: 1 }
            }
          }
        ]),
        // Fetch active users
        User.find({ isActive: true }).select('_id department').lean()
      ]);

      // Build lookup maps
      const attendanceMap = new Map();
      for (const item of attendanceAgg) {
        attendanceMap.set(item._id.toString(), item);
      }

      const fineMap = new Map();
      for (const item of fineAgg) {
        fineMap.set(item._id.toString(), item);
      }

      // Build department insights from the aggregated data
      const departments = {};

      for (const user of users) {
        const dept = user.department || 'Unknown';
        if (!departments[dept]) {
          departments[dept] = {
            totalEmployees: 0,
            totalPresent: 0,
            totalDays: 0,
            totalWorkHours: 0,
            totalFines: 0,
            attritionRisks: 0,
            employeeCount: 0
          };
        }
        departments[dept].totalEmployees++;

        const uid = user._id.toString();
        const attData = attendanceMap.get(uid);
        const fineData = fineMap.get(uid);

        if (attData) {
          departments[dept].totalPresent += attData.presentDays;
          departments[dept].totalDays += attData.totalDays;
          departments[dept].totalWorkHours += attData.totalWorkHours;
          departments[dept].employeeCount++;
        }

        if (fineData) {
          departments[dept].totalFines += fineData.totalFines;
        }

        // Lightweight attrition heuristic: use the aggregated data instead of full recalculation
        if (attData && attData.totalDays > 0) {
          const attendanceRate = attData.presentDays / attData.totalDays;
          const avgHours = attData.totalWorkHours / attData.totalDays;
          if (attendanceRate < 0.6 || avgHours < 5) {
            departments[dept].attritionRisks++;
          }
        }
      }

      // Calculate averages per department
      for (const dept of Object.keys(departments)) {
        const d = departments[dept];
        d.avgAttendance = d.totalDays > 0
          ? ((d.totalPresent / d.totalDays) * 100).toFixed(1)
          : 0;
        d.avgWorkHours = d.employeeCount > 0
          ? (d.totalWorkHours / d.employeeCount / 30).toFixed(1) // per day approx
          : 0;

        // Clean up internal aggregation fields
        delete d.totalPresent;
        delete d.totalDays;
        delete d.totalWorkHours;
        delete d.employeeCount;
      }

      return departments;
    } catch (error) {
      logger.error('Error in getDepartmentInsights:', error);
      throw error;
    }
  }
}

module.exports = new PredictiveAnalytics();
