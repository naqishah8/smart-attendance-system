const mongoose = require('mongoose');

const SalarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },

  // Base calculation
  baseSalary: { type: Number, required: true },
  proratedDays: Number,
  workingDaysInMonth: Number,
  daysPresent: Number,
  daysAbsent: Number,

  // Earnings
  bonuses: [{
    type: { type: String, enum: ['perfect-attendance', 'overtime', 'performance', 'other'] },
    amount: Number,
    description: String,
    ruleId: { type: mongoose.Schema.Types.ObjectId }
  }],
  overtimeEarnings: Number,
  totalEarnings: Number,

  // Deductions
  fines: [{
    fineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fine' },
    amount: Number
  }],
  loanDeductions: [{
    loanId: { type: mongoose.Schema.Types.ObjectId },
    amount: Number
  }],
  taxDeductions: Number,
  totalDeductions: Number,

  // Net
  netSalary: Number,

  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'processed', 'paid'],
    default: 'pending'
  },
  paymentDate: Date,
  transactionId: String,

  // Documents
  payslipUrl: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Perfect Attendance Bonus Rule
const BonusRuleSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ['perfect-attendance', 'overtime', 'referral', 'performance'] },

  // Eligibility
  minAttendance: { type: Number, default: 100 }, // percentage
  consecutiveMonths: { type: Number, default: 1 },

  // Reward
  amountType: { type: String, enum: ['fixed', 'percentage'] },
  amountValue: Number,

  // For overtime
  overtimeMultiplier: Number,
  minOvertimeHours: Number,

  isActive: { type: Boolean, default: true }
});

module.exports = {
  Salary: mongoose.model('Salary', SalarySchema),
  BonusRule: mongoose.model('BonusRule', BonusRuleSchema)
};
