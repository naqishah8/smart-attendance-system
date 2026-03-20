const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const { Fine } = require('../../models/Fine');
const moment = require('moment');

class PredictiveAnalytics {
  async analyzeAttritionRisk() {
    const users = await User.find({ isActive: true });
    const risks = [];

    for (const user of users) {
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
    }

    return risks.sort((a, b) => b.score - a.score);
  }

  async calculateAttritionRisk(userId) {
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

    // Factor 5: PPE compliance drop
    const ppeViolations = attendances.filter(a =>
      a.detections.some(d =>
        d.ppeCompliance && (!d.ppeCompliance.helmet || !d.ppeCompliance.vest)
      )
    ).length;
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
      rate: (monthly[month].present / monthly[month].total) * 100
    })).sort((a, b) => b.month.localeCompare(a.month));
  }

  async predictAttendance(date) {
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
    const dayData = historicalData.find(d => d._id === dayOfWeek + 1);

    if (!dayData) {
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
  }

  async detectAnomalies(userId, date) {
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

    // Check for multiple PPE violations in one day
    const ppeViolations = attendance.detections.filter(d =>
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
    const fatiguedDetections = attendance.detections.filter(
      d => d.emotion === 'fatigued'
    ).length;

    if (fatiguedDetections > 5) {
      anomalies.push({
        type: 'fatigue_detected',
        severity: 'medium',
        description: `Employee appears fatigued (${fatiguedDetections} detections)`
      });
    }

    return anomalies;
  }

  async getDepartmentInsights() {
    const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

    const users = await User.find({ isActive: true });
    const departments = {};

    for (const user of users) {
      const dept = user.department;
      if (!departments[dept]) {
        departments[dept] = {
          totalEmployees: 0,
          avgAttendance: 0,
          avgWorkHours: 0,
          totalFines: 0,
          attritionRisks: 0,
          attendanceData: []
        };
      }
      departments[dept].totalEmployees++;

      const attendances = await Attendance.find({
        userId: user._id,
        date: { $gte: thirtyDaysAgo }
      });

      const presentDays = attendances.filter(a => a.status !== 'absent').length;
      const avgHours = attendances.length > 0
        ? attendances.reduce((s, a) => s + (a.effectiveWorkHours || 0), 0) / attendances.length
        : 0;

      departments[dept].attendanceData.push({
        presentDays,
        totalDays: attendances.length,
        avgHours
      });

      const risk = await this.calculateAttritionRisk(user._id);
      if (risk.score > 0.7) departments[dept].attritionRisks++;
    }

    // Calculate averages per department
    for (const dept of Object.keys(departments)) {
      const data = departments[dept].attendanceData;
      const totalPresent = data.reduce((s, d) => s + d.presentDays, 0);
      const totalDays = data.reduce((s, d) => s + d.totalDays, 0);
      departments[dept].avgAttendance = totalDays > 0
        ? ((totalPresent / totalDays) * 100).toFixed(1)
        : 0;
      departments[dept].avgWorkHours = data.length > 0
        ? (data.reduce((s, d) => s + d.avgHours, 0) / data.length).toFixed(1)
        : 0;
      delete departments[dept].attendanceData;
    }

    return departments;
  }
}

module.exports = new PredictiveAnalytics();
