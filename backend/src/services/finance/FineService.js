const { Fine, FineRule } = require('../../models/Fine');
const User = require('../../models/User');
const moment = require('moment');
const logger = require('../../utils/logger');

class FineService {
  async checkForFines(attendance) {
    try {
      if (!attendance || !attendance.userId) {
        logger.error('checkForFines called with invalid attendance');
        return;
      }

      // Get all active fine rules
      const rules = await FineRule.find({ isActive: true });

      for (const rule of rules) {
        await this.applyRuleIfApplicable(rule, attendance);
      }
    } catch (error) {
      logger.error('Error in checkForFines:', error);
      throw error;
    }
  }

  async applyRuleIfApplicable(rule, attendance) {
    try {
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

        case 'safety': {
          // Null/empty check on detections before iterating
          const detections = attendance.detections;
          if (!detections || detections.length === 0) break;

          // Check all detections for safety violations
          for (const detection of detections) {
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
        }

        case 'absent':
          if (attendance.status === 'absent') {
            await this.createFine(userId, rule, attendance, {
              type: 'absent'
            });
          }
          break;

        case 'ppe': {
          // Null/empty check: detections could be empty array
          const ppeDetections = attendance.detections;
          if (!ppeDetections || ppeDetections.length === 0) break;

          const lastDetection = ppeDetections[ppeDetections.length - 1];
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
    } catch (error) {
      logger.error('Error in applyRuleIfApplicable:', error);
      throw error;
    }
  }

  async createFine(userId, rule, attendance, details) {
    try {
      // Input validation
      if (!userId || !rule || !rule._id) {
        logger.error('createFine called with invalid arguments');
        return null;
      }

      // Idempotency check: prevent duplicate fines for same attendanceId + ruleId
      if (attendance?._id) {
        const existingFine = await Fine.findOne({
          attendanceId: attendance._id,
          'type.ruleId': rule._id,
          detectionId: details.detectionId || null
        });

        if (existingFine) {
          logger.info(`Fine already exists for attendance ${attendance._id} and rule ${rule._id}`);
          return existingFine;
        }
      }

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
        if (!user) {
          logger.error(`User ${userId} not found when calculating fine amount`);
          return null;
        }
        amount = (user.baseSalary * rule.amountValue) / 100;
      }

      // Create fine record
      const fine = await Fine.create({
        userId,
        type: {
          category: details.type,
          ruleId: rule._id
        },
        attendanceId: attendance?._id || null,
        detectionId: details.detectionId || null,
        amount,
        evidence: {
          description: this.generateDescription(details),
          timestamp: new Date()
        },
        status: 'pending'
      });

      return fine;
    } catch (error) {
      logger.error('Error in createFine:', error);
      throw error;
    }
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
    try {
      if (!userId || !date) {
        logger.error('applyAbsentFine called with invalid arguments');
        return;
      }

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
        if (!user) {
          logger.error(`User ${userId} not found when applying absent fine`);
          return;
        }
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
    } catch (error) {
      logger.error('Error in applyAbsentFine:', error);
      throw error;
    }
  }

  async disputeFine(fineId, reason) {
    try {
      if (!fineId || !reason) {
        throw new Error('fineId and reason are required');
      }

      const fine = await Fine.findById(fineId);
      if (!fine) throw new Error('Fine not found');

      fine.status = 'disputed';
      fine.dispute = {
        reason,
        filedAt: new Date()
      };

      await fine.save();
      return fine;
    } catch (error) {
      logger.error('Error in disputeFine:', error);
      throw error;
    }
  }

  async resolveFineDispute(fineId, resolution, waive = false) {
    try {
      if (!fineId || !resolution) {
        throw new Error('fineId and resolution are required');
      }

      const fine = await Fine.findById(fineId);
      if (!fine) throw new Error('Fine not found');

      // Null check: ensure fine.dispute exists before setting resolvedAt
      if (!fine.dispute) {
        throw new Error('Fine has no active dispute to resolve');
      }

      fine.dispute.resolvedAt = new Date();
      fine.dispute.resolution = resolution;
      fine.status = waive ? 'waived' : 'applied';

      await fine.save();
      return fine;
    } catch (error) {
      logger.error('Error in resolveFineDispute:', error);
      throw error;
    }
  }

  async getUserFines(userId, startDate, endDate) {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }

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
    } catch (error) {
      logger.error('Error in getUserFines:', error);
      throw error;
    }
  }
}

module.exports = new FineService();
