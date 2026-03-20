const { Fine, FineRule } = require('../../models/Fine');
const User = require('../../models/User');
const moment = require('moment');

class FineService {
  async checkForFines(attendance) {
    // Get all active fine rules
    const rules = await FineRule.find({ isActive: true });

    for (const rule of rules) {
      await this.applyRuleIfApplicable(rule, attendance);
    }
  }

  async applyRuleIfApplicable(rule, attendance) {
    const userId = attendance.userId;

    switch (rule.category) {
      case 'late':
        if (attendance.shiftCompliance?.wasLate) {
          const lateMinutes = attendance.shiftCompliance.lateMinutes;

          if (lateMinutes > rule.condition.threshold) {
            await this.createFine(userId, rule, attendance, {
              minutes: lateMinutes,
              type: 'late'
            });
          }
        }
        break;

      case 'safety':
        // Check all detections for safety violations
        for (const detection of attendance.detections) {
          const missingPPE = [];

          if (rule.condition.requiredPPE.includes('helmet') && !detection.ppeCompliance?.helmet) {
            missingPPE.push('helmet');
          }
          if (rule.condition.requiredPPE.includes('vest') && !detection.ppeCompliance?.vest) {
            missingPPE.push('vest');
          }
          if (rule.condition.requiredPPE.includes('goggles') && !detection.ppeCompliance?.goggles) {
            missingPPE.push('goggles');
          }
          if (rule.condition.requiredPPE.includes('gloves') && !detection.ppeCompliance?.gloves) {
            missingPPE.push('gloves');
          }

          if (missingPPE.length > 0) {
            await this.createFine(userId, rule, attendance, {
              missingPPE,
              type: 'ppe-violation',
              detectionId: detection._id
            });
          }
        }
        break;

      case 'absent':
        if (attendance.status === 'absent') {
          await this.createFine(userId, rule, attendance, {
            type: 'absent'
          });
        }
        break;

      case 'ppe':
        // Similar to safety but specific to PPE rules
        const lastDetection = attendance.detections[attendance.detections.length - 1];
        if (lastDetection) {
          const missing = rule.condition.requiredPPE.filter(item => {
            return !lastDetection.ppeCompliance?.[item];
          });

          if (missing.length > 0) {
            await this.createFine(userId, rule, attendance, {
              missingPPE: missing,
              type: 'ppe-violation',
              detectionId: lastDetection._id
            });
          }
        }
        break;
    }
  }

  async createFine(userId, rule, attendance, details) {
    // Check daily limit
    const todayStart = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();

    const todayFineCount = await Fine.countDocuments({
      userId,
      'type.ruleId': rule._id,
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });

    if (todayFineCount >= rule.maxPerDay) return null;

    // Check monthly limit
    if (rule.maxPerMonth) {
      const monthStart = moment().startOf('month').toDate();
      const monthEnd = moment().endOf('month').toDate();

      const monthFineCount = await Fine.countDocuments({
        userId,
        'type.ruleId': rule._id,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      if (monthFineCount >= rule.maxPerMonth) return null;
    }

    // Calculate fine amount
    let amount = 0;
    if (rule.amountType === 'fixed') {
      amount = rule.amountValue;
    } else if (rule.amountType === 'percentage') {
      const user = await User.findById(userId);
      amount = (user.baseSalary * rule.amountValue) / 100;
    }

    // Create fine record
    const fine = await Fine.create({
      userId,
      type: {
        category: details.type,
        ruleId: rule._id
      },
      attendanceId: attendance._id,
      detectionId: details.detectionId,
      amount,
      evidence: {
        description: this.generateDescription(details),
        timestamp: new Date()
      },
      status: 'pending'
    });

    return fine;
  }

  generateDescription(details) {
    switch (details.type) {
      case 'late':
        return `Late arrival by ${details.minutes} minutes`;
      case 'absent':
        return 'Absent without leave';
      case 'ppe-violation':
        return `Missing PPE: ${details.missingPPE.join(', ')}`;
      case 'early-departure':
        return `Early departure by ${details.minutes} minutes`;
      default:
        return 'Fine applied';
    }
  }

  async applyAbsentFine(userId, date) {
    const absentRule = await FineRule.findOne({
      category: 'absent',
      isActive: true
    });

    if (!absentRule) return;

    let amount = 0;
    if (absentRule.amountType === 'fixed') {
      amount = absentRule.amountValue;
    } else {
      const user = await User.findById(userId);
      amount = (user.baseSalary * absentRule.amountValue) / 100;
    }

    await Fine.create({
      userId,
      type: {
        category: 'absent',
        ruleId: absentRule._id
      },
      amount,
      evidence: {
        description: `Absent on ${moment(date).format('YYYY-MM-DD')}`,
        timestamp: new Date()
      },
      status: 'pending'
    });
  }

  async disputeFine(fineId, reason) {
    const fine = await Fine.findById(fineId);
    if (!fine) throw new Error('Fine not found');

    fine.status = 'disputed';
    fine.dispute = {
      reason,
      filedAt: new Date()
    };

    await fine.save();
    return fine;
  }

  async resolveFineDispute(fineId, resolution, waive = false) {
    const fine = await Fine.findById(fineId);
    if (!fine) throw new Error('Fine not found');

    fine.dispute.resolvedAt = new Date();
    fine.dispute.resolution = resolution;
    fine.status = waive ? 'waived' : 'applied';

    await fine.save();
    return fine;
  }

  async getUserFines(userId, startDate, endDate) {
    const query = { userId };

    if (startDate && endDate) {
      query.createdAt = { $gte: startDate, $lte: endDate };
    }

    const fines = await Fine.find(query)
      .populate('type.ruleId')
      .sort({ createdAt: -1 });

    const summary = {
      totalFines: fines.length,
      totalAmount: fines
        .filter(f => f.status !== 'waived')
        .reduce((sum, f) => sum + f.amount, 0),
      pending: fines.filter(f => f.status === 'pending').length,
      applied: fines.filter(f => f.status === 'applied').length,
      disputed: fines.filter(f => f.status === 'disputed').length,
      waived: fines.filter(f => f.status === 'waived').length
    };

    return { fines, summary };
  }
}

module.exports = new FineService();
