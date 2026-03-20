const Loan = require('../../models/Loan');
const User = require('../../models/User');
const moment = require('moment');

class LoanService {
  async requestLoan(userId, amount, purpose, installments) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Check if user already has active loan
    const activeLoan = await Loan.findOne({
      userId,
      status: 'active'
    });

    if (activeLoan) {
      throw new Error('User already has an active loan');
    }

    // Validate loan amount (max 3x monthly salary)
    const maxLoanAmount = user.baseSalary * 3;
    if (amount > maxLoanAmount) {
      throw new Error(`Loan amount exceeds maximum allowed (${maxLoanAmount})`);
    }

    // Validate installments (max 12 months)
    if (installments > 12) {
      throw new Error('Maximum installment period is 12 months');
    }

    // Calculate installment amount
    const installmentAmount = Math.ceil(amount / installments);

    // Determine start and end dates
    const startMonth = moment().add(1, 'month').month() + 1; // Next month
    const startYear = moment().add(1, 'month').year();
    const endDate = moment().add(1, 'month').add(installments, 'months');
    const endMonth = endDate.month() + 1;
    const endYear = endDate.year();

    const loan = await Loan.create({
      userId,
      amount,
      purpose,
      interestRate: 0, // Interest-free employee loan
      totalInstallments: installments,
      installmentAmount,
      installmentsPaid: 0,
      startMonth,
      startYear,
      endMonth,
      endYear,
      status: 'active'
    });

    return loan;
  }

  async approveLoan(loanId, approvedById) {
    const loan = await Loan.findById(loanId);
    if (!loan) throw new Error('Loan not found');

    loan.approvedBy = approvedById;
    loan.approvedAt = new Date();

    await loan.save();
    return loan;
  }

  async recordDeduction(loanId, salaryId, month, year) {
    const loan = await Loan.findById(loanId);
    if (!loan) throw new Error('Loan not found');

    if (loan.status !== 'active') {
      throw new Error('Loan is not active');
    }

    // Check if already deducted for this month
    const alreadyDeducted = loan.deductions.some(
      d => d.month === month && d.year === year
    );

    if (alreadyDeducted) {
      throw new Error('Deduction already recorded for this month');
    }

    loan.deductions.push({
      salaryId,
      amount: loan.installmentAmount,
      month,
      year,
      date: new Date()
    });

    loan.installmentsPaid += 1;

    // Check if loan is completed
    if (loan.installmentsPaid >= loan.totalInstallments) {
      loan.status = 'completed';
    }

    await loan.save();
    return loan;
  }

  async getUserLoans(userId) {
    const loans = await Loan.find({ userId }).sort({ createdAt: -1 });

    const summary = {
      totalLoans: loans.length,
      activeLoans: loans.filter(l => l.status === 'active').length,
      completedLoans: loans.filter(l => l.status === 'completed').length,
      totalBorrowed: loans.reduce((sum, l) => sum + l.amount, 0),
      totalOutstanding: 0
    };

    // Calculate outstanding amount for active loans
    const activeLoans = loans.filter(l => l.status === 'active');
    summary.totalOutstanding = activeLoans.reduce((sum, l) => {
      const paid = l.installmentsPaid * l.installmentAmount;
      return sum + (l.amount - paid);
    }, 0);

    return { loans, summary };
  }

  async getLoanDetails(loanId) {
    const loan = await Loan.findById(loanId)
      .populate('userId', 'firstName lastName employeeId department')
      .populate('approvedBy', 'firstName lastName');

    if (!loan) throw new Error('Loan not found');

    const paidAmount = loan.installmentsPaid * loan.installmentAmount;
    const remainingAmount = loan.amount - paidAmount;
    const remainingInstallments = loan.totalInstallments - loan.installmentsPaid;

    return {
      loan,
      paidAmount,
      remainingAmount,
      remainingInstallments,
      progress: ((loan.installmentsPaid / loan.totalInstallments) * 100).toFixed(1)
    };
  }

  async getActiveLoansForDeduction(month, year) {
    // Get all active loans that need deduction for the given month
    const activeLoans = await Loan.find({ status: 'active' });

    return activeLoans.filter(loan => {
      const loanStart = moment({ year: loan.startYear, month: loan.startMonth - 1 });
      const currentMonth = moment({ year, month: month - 1 });

      // Loan should have started
      if (currentMonth.isBefore(loanStart)) return false;

      // Not already deducted for this month
      const alreadyDeducted = loan.deductions.some(
        d => d.month === month && d.year === year
      );

      return !alreadyDeducted && loan.installmentsPaid < loan.totalInstallments;
    });
  }

  async markDefaultedLoans() {
    // Mark loans as defaulted if past end date with remaining installments
    const now = moment();

    const activeLoans = await Loan.find({ status: 'active' });

    for (const loan of activeLoans) {
      if (!loan.endMonth || !loan.endYear) continue;

      const endDate = moment({ year: loan.endYear, month: loan.endMonth - 1 }).endOf('month');

      if (now.isAfter(endDate) && loan.installmentsPaid < loan.totalInstallments) {
        loan.status = 'defaulted';
        await loan.save();
      }
    }
  }

  async getLoanSummaryReport() {
    const allLoans = await Loan.find().populate('userId', 'firstName lastName department');

    const totalDisbursed = allLoans.reduce((sum, l) => sum + l.amount, 0);
    const totalRecovered = allLoans.reduce((sum, l) => {
      return sum + (l.installmentsPaid * l.installmentAmount);
    }, 0);
    const totalOutstanding = totalDisbursed - totalRecovered;

    const byDepartment = {};
    allLoans.forEach(loan => {
      const dept = loan.userId?.department || 'Unknown';
      if (!byDepartment[dept]) {
        byDepartment[dept] = { count: 0, totalAmount: 0, outstanding: 0 };
      }
      byDepartment[dept].count++;
      byDepartment[dept].totalAmount += loan.amount;
      byDepartment[dept].outstanding += loan.amount - (loan.installmentsPaid * loan.installmentAmount);
    });

    return {
      totalLoans: allLoans.length,
      active: allLoans.filter(l => l.status === 'active').length,
      completed: allLoans.filter(l => l.status === 'completed').length,
      defaulted: allLoans.filter(l => l.status === 'defaulted').length,
      totalDisbursed,
      totalRecovered,
      totalOutstanding,
      byDepartment
    };
  }
}

module.exports = new LoanService();
