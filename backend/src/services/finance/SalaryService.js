const { Salary, BonusRule } = require('../../models/Salary');
const { Fine } = require('../../models/Fine');
const Loan = require('../../models/Loan');
const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const moment = require('moment');

class SalaryService {
  async calculateMonthlySalary(userId, month, year) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Get attendance data for the month
    const monthStart = moment({ year, month: month - 1 }).startOf('month').toDate();
    const monthEnd = moment({ year, month: month - 1 }).endOf('month').toDate();

    const attendances = await Attendance.find({
      userId,
      date: { $gte: monthStart, $lte: monthEnd }
    });

    // Calculate working days in the month (excluding weekends)
    const workingDaysInMonth = this.getWorkingDays(month, year);

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
    const bonuses = await this.calculateBonuses(userId, month, year, attendances);
    const totalBonusAmount = bonuses.reduce((sum, b) => sum + b.amount, 0);

    // Total earnings
    const totalEarnings = proratedSalary + overtimeEarnings + totalBonusAmount;

    // Get fines for the month
    const fines = await Fine.find({
      userId,
      status: { $in: ['pending', 'applied'] },
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });
    const totalFines = fines.reduce((sum, f) => sum + f.amount, 0);

    // Get loan deductions
    const loanDeductions = await this.getLoanDeductions(userId, month, year);
    const totalLoanDeductions = loanDeductions.reduce((sum, l) => sum + l.amount, 0);

    // Tax deductions (simplified)
    const taxableIncome = totalEarnings - totalFines - totalLoanDeductions;
    const taxDeductions = this.calculateTax(taxableIncome);

    // Total deductions
    const totalDeductions = totalFines + totalLoanDeductions + taxDeductions;

    // Net salary
    const netSalary = totalEarnings - totalDeductions;

    // Create or update salary record
    let salary = await Salary.findOne({ userId, month, year });

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

    await salary.save();

    // Mark fines as applied
    await Fine.updateMany(
      { _id: { $in: fines.map(f => f._id) }, status: 'pending' },
      { status: 'applied' }
    );

    return salary;
  }

  async calculateBonuses(userId, month, year, attendances) {
    const bonuses = [];
    const activeRules = await BonusRule.find({ isActive: true });

    for (const rule of activeRules) {
      switch (rule.type) {
        case 'perfect-attendance': {
          // Check if user had perfect attendance
          const workingDays = this.getWorkingDays(month, year);
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

            const user = await User.findById(userId);
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
            const user = await User.findById(userId);
            const hourlyRate = user.baseSalary / (this.getWorkingDays(month, year) * 8);
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
  }

  async checkConsecutivePerfectAttendance(userId, month, year, requiredMonths) {
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

      const attendanceRate = prevSalary.daysPresent / prevSalary.workingDaysInMonth * 100;
      if (attendanceRate < 100) return false;
    }

    return true;
  }

  async getLoanDeductions(userId, month, year) {
    const activeLoans = await Loan.find({
      userId,
      status: 'active'
    });

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
    const salary = await Salary.findById(salaryId).populate('userId');
    if (!salary) throw new Error('Salary record not found');

    const user = await User.findById(salary.userId);

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
        proratedSalary: (salary.baseSalary / salary.workingDaysInMonth) * salary.proratedDays,
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
  }

  async processAllSalaries(month, year) {
    const activeUsers = await User.find({ isActive: true });
    const results = [];

    for (const user of activeUsers) {
      try {
        const salary = await this.calculateMonthlySalary(user._id, month, year);
        results.push({ userId: user._id, status: 'success', netSalary: salary.netSalary });
      } catch (error) {
        results.push({ userId: user._id, status: 'error', error: error.message });
      }
    }

    return results;
  }
}

module.exports = new SalaryService();
