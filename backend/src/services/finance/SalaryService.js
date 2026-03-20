const mongoose = require('mongoose');
const { Salary, BonusRule } = require('../../models/Salary');
const { Fine } = require('../../models/Fine');
const Loan = require('../../models/Loan');
const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const moment = require('moment');
const logger = require('../../utils/logger');

class SalaryService {
  async calculateMonthlySalary(userId, month, year) {
    // Input validation
    if (!userId || !month || !year) {
      throw new Error('userId, month, and year are required');
    }
    if (month < 1 || month > 12) {
      throw new Error('month must be between 1 and 12');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(userId).session(session);
      if (!user) throw new Error('User not found');

      // Get attendance data for the month
      const monthStart = moment({ year, month: month - 1 }).startOf('month').toDate();
      const monthEnd = moment({ year, month: month - 1 }).endOf('month').toDate();

      const attendances = await Attendance.find({
        userId,
        date: { $gte: monthStart, $lte: monthEnd }
      }).session(session);

      // Calculate working days in the month (excluding weekends)
      const workingDaysInMonth = this.getWorkingDays(month, year);

      // Guard against division by zero
      if (workingDaysInMonth === 0) {
        await session.abortTransaction();
        session.endSession();
        throw new Error('No working days in the specified month');
      }

      // Count attendance
      const daysPresent = attendances.filter(a =>
        ['present', 'late'].includes(a.status)
      ).length;
      const halfDays = attendances.filter(a => a.status === 'half-day').length;
      const daysAbsent = workingDaysInMonth - daysPresent - (halfDays * 0.5);

      // Base salary calculation (prorated)
      const dailyRate = user.baseSalary / workingDaysInMonth;
      const proratedSalary = dailyRate * (daysPresent + (halfDays * 0.5));

      // Calculate overtime earnings
      const totalOvertimeHours = attendances.reduce((sum, a) => {
        return sum + (a.shiftCompliance?.overtimeHours || 0);
      }, 0);
      const hourlyRate = user.baseSalary / (workingDaysInMonth * 8);
      const overtimeEarnings = totalOvertimeHours * hourlyRate * 1.5;

      // Calculate bonuses
      const bonuses = await this.calculateBonuses(userId, month, year, attendances, session);
      const totalBonusAmount = bonuses.reduce((sum, b) => sum + b.amount, 0);

      // Total earnings
      const totalEarnings = proratedSalary + overtimeEarnings + totalBonusAmount;

      // Get fines for the month
      const fines = await Fine.find({
        userId,
        status: { $in: ['pending', 'applied'] },
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }).session(session);
      const totalFines = fines.reduce((sum, f) => sum + f.amount, 0);

      // Get loan deductions
      const loanDeductions = await this.getLoanDeductions(userId, month, year, session);
      const totalLoanDeductions = loanDeductions.reduce((sum, l) => sum + l.amount, 0);

      // Tax deductions (simplified)
      const taxableIncome = totalEarnings - totalFines - totalLoanDeductions;
      const taxDeductions = this.calculateTax(taxableIncome);

      // Total deductions
      const totalDeductions = totalFines + totalLoanDeductions + taxDeductions;

      // Net salary
      const netSalary = totalEarnings - totalDeductions;

      // Create or update salary record
      let salary = await Salary.findOne({ userId, month, year }).session(session);

      if (!salary) {
        salary = new Salary({ userId, month, year });
      }

      salary.baseSalary = user.baseSalary;
      salary.proratedDays = daysPresent + (halfDays * 0.5);
      salary.workingDaysInMonth = workingDaysInMonth;
      salary.daysPresent = daysPresent;
      salary.daysAbsent = daysAbsent;
      salary.bonuses = bonuses;
      salary.overtimeEarnings = overtimeEarnings;
      salary.totalEarnings = totalEarnings;
      salary.fines = fines.map(f => ({ fineId: f._id, amount: f.amount }));
      salary.loanDeductions = loanDeductions;
      salary.taxDeductions = taxDeductions;
      salary.totalDeductions = totalDeductions;
      salary.netSalary = netSalary;

      await salary.save({ session });

      // Mark fines as applied
      await Fine.updateMany(
        { _id: { $in: fines.map(f => f._id) }, status: 'pending' },
        { status: 'applied' }
      ).session(session);

      await session.commitTransaction();
      session.endSession();

      return salary;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error('Error in calculateMonthlySalary:', error);
      throw error;
    }
  }

  async calculateBonuses(userId, month, year, attendances, session) {
    try {
      const bonuses = [];
      const activeRules = await BonusRule.find({ isActive: true }).session(session || null);

      const workingDays = this.getWorkingDays(month, year);
      if (workingDays === 0) return bonuses;

      // Fetch user once rather than inside each rule iteration
      const user = await User.findById(userId).session(session || null);
      if (!user) return bonuses;

      for (const rule of activeRules) {
        switch (rule.type) {
          case 'perfect-attendance': {
            const presentDays = attendances.filter(a =>
              ['present'].includes(a.status)
            ).length;
            const attendancePercentage = (presentDays / workingDays) * 100;

            if (attendancePercentage >= rule.minAttendance) {
              // Check consecutive months if required
              if (rule.consecutiveMonths > 1) {
                const hasConsecutive = await this.checkConsecutivePerfectAttendance(
                  userId, month, year, rule.consecutiveMonths
                );
                if (!hasConsecutive) continue;
              }

              const amount = rule.amountType === 'fixed'
                ? rule.amountValue
                : (user.baseSalary * rule.amountValue) / 100;

              bonuses.push({
                type: 'perfect-attendance',
                amount,
                description: `Perfect attendance bonus (${attendancePercentage.toFixed(1)}%)`,
                ruleId: rule._id
              });
            }
            break;
          }

          case 'overtime': {
            const totalOT = attendances.reduce((sum, a) => {
              return sum + (a.shiftCompliance?.overtimeHours || 0);
            }, 0);

            if (totalOT >= (rule.minOvertimeHours || 0)) {
              const hourlyRate = user.baseSalary / (workingDays * 8);
              const amount = totalOT * hourlyRate * (rule.overtimeMultiplier || 1.5);

              bonuses.push({
                type: 'overtime',
                amount,
                description: `Overtime bonus for ${totalOT.toFixed(1)} hours`,
                ruleId: rule._id
              });
            }
            break;
          }
        }
      }

      return bonuses;
    } catch (error) {
      logger.error('Error in calculateBonuses:', error);
      throw error;
    }
  }

  async checkConsecutivePerfectAttendance(userId, month, year, requiredMonths) {
    try {
      for (let i = 1; i < requiredMonths; i++) {
        let checkMonth = month - i;
        let checkYear = year;

        if (checkMonth <= 0) {
          checkMonth += 12;
          checkYear -= 1;
        }

        const prevSalary = await Salary.findOne({
          userId,
          month: checkMonth,
          year: checkYear
        });

        if (!prevSalary) return false;

        // Null check: avoid division by zero
        if (!prevSalary.workingDaysInMonth || prevSalary.workingDaysInMonth === 0) return false;

        const attendanceRate = prevSalary.daysPresent / prevSalary.workingDaysInMonth * 100;
        if (attendanceRate < 100) return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in checkConsecutivePerfectAttendance:', error);
      throw error;
    }
  }

  async getLoanDeductions(userId, month, year, session) {
    try {
      const activeLoans = await Loan.find({
        userId,
        status: 'active'
      }).session(session || null);

      const deductions = [];

      for (const loan of activeLoans) {
        // Check if this month falls within loan period
        const loanStart = moment({ year: loan.startYear, month: loan.startMonth - 1 });
        const currentMonth = moment({ year, month: month - 1 });

        if (currentMonth.isBefore(loanStart)) continue;

        // Check if already deducted for this month
        const alreadyDeducted = loan.deductions.some(
          d => d.month === month && d.year === year
        );

        if (alreadyDeducted) continue;

        if (loan.installmentsPaid < loan.totalInstallments) {
          deductions.push({
            loanId: loan._id,
            amount: loan.installmentAmount
          });
        }
      }

      return deductions;
    } catch (error) {
      logger.error('Error in getLoanDeductions:', error);
      throw error;
    }
  }

  calculateTax(taxableIncome) {
    // Simplified tax calculation — customize per jurisdiction
    if (taxableIncome <= 0) return 0;
    if (taxableIncome <= 250000) return 0;
    if (taxableIncome <= 500000) return (taxableIncome - 250000) * 0.05;
    if (taxableIncome <= 1000000) return 12500 + (taxableIncome - 500000) * 0.2;
    return 112500 + (taxableIncome - 1000000) * 0.3;
  }

  getWorkingDays(month, year) {
    const start = moment({ year, month: month - 1 }).startOf('month');
    const end = moment({ year, month: month - 1 }).endOf('month');

    let workingDays = 0;
    const current = start.clone();

    while (current.isSameOrBefore(end)) {
      const dayOfWeek = current.day();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Sunday and Saturday
        workingDays++;
      }
      current.add(1, 'day');
    }

    return workingDays;
  }

  async generatePayslip(salaryId) {
    try {
      if (!salaryId) {
        throw new Error('salaryId is required');
      }

      const salary = await Salary.findById(salaryId).populate('userId');
      if (!salary) throw new Error('Salary record not found');

      const user = await User.findById(salary.userId);
      if (!user) throw new Error('User not found for this salary record');

      // Guard against division by zero
      const proratedSalary = salary.workingDaysInMonth > 0
        ? (salary.baseSalary / salary.workingDaysInMonth) * salary.proratedDays
        : 0;

      return {
        employee: {
          name: `${user.firstName} ${user.lastName}`,
          employeeId: user.employeeId,
          department: user.department,
          designation: user.designation
        },
        period: {
          month: salary.month,
          year: salary.year
        },
        earnings: {
          baseSalary: salary.baseSalary,
          proratedSalary,
          overtimeEarnings: salary.overtimeEarnings,
          bonuses: salary.bonuses,
          totalEarnings: salary.totalEarnings
        },
        deductions: {
          fines: salary.fines,
          loanDeductions: salary.loanDeductions,
          taxDeductions: salary.taxDeductions,
          totalDeductions: salary.totalDeductions
        },
        attendance: {
          workingDays: salary.workingDaysInMonth,
          daysPresent: salary.daysPresent,
          daysAbsent: salary.daysAbsent
        },
        netSalary: salary.netSalary,
        paymentStatus: salary.paymentStatus
      };
    } catch (error) {
      logger.error('Error in generatePayslip:', error);
      throw error;
    }
  }

  async processAllSalaries(month, year) {
    try {
      if (!month || !year) {
        throw new Error('month and year are required');
      }

      const activeUsers = await User.find({ isActive: true }).select('_id');

      // Use Promise.allSettled for parallel processing so one failure doesn't block others
      const results = await Promise.allSettled(
        activeUsers.map(user =>
          this.calculateMonthlySalary(user._id, month, year)
        )
      );

      return results.map((result, index) => {
        const userId = activeUsers[index]._id;
        if (result.status === 'fulfilled') {
          return { userId, status: 'success', netSalary: result.value.netSalary };
        } else {
          logger.error(`Salary processing failed for user ${userId}:`, result.reason);
          return { userId, status: 'error', error: result.reason?.message || 'Unknown error' };
        }
      });
    } catch (error) {
      logger.error('Error in processAllSalaries:', error);
      throw error;
    }
  }
}

module.exports = new SalaryService();
