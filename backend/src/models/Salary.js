const mongoose = require('mongoose');

const SalarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true, min: 2000 },

  baseSalary: { type: Number, required: true, min: 0 },
  proratedDays: { type: Number, min: 0 },
  workingDaysInMonth: { type: Number, min: 0, max: 31 },
  daysPresent: { type: Number, min: 0 },
  daysAbsent: { type: Number, min: 0 },

  bonuses: [{
    type: { type: String, enum: ['perfect-attendance', 'overtime', 'performance', 'other'] },
    amount: { type: Number, min: 0 },
    description: String,
    ruleId: { type: mongoose.Schema.Types.ObjectId }
  }],
  overtimeEarnings: { type: Number, default: 0, min: 0 },
  totalEarnings: { type: Number, default: 0, min: 0 },

  fines: [{
    fineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fine' },
    amount: { type: Number, min: 0 }
  }],
  loanDeductions: [{
    loanId: { type: mongoose.Schema.Types.ObjectId },
    amount: { type: Number, min: 0 }
  }],
  taxDeductions: { type: Number, default: 0, min: 0 },
  totalDeductions: { type: Number, default: 0, min: 0 },

  netSalary: { type: Number, default: 0 },

  paymentStatus: {
    type: String,
    enum: ['pending', 'processed', 'paid'],
    default: 'pending'
  },
  paymentDate: Date,
  transactionId: String,
  payslipUrl: String
}, { timestamps: true });

// Prevent duplicate salary records for same user/month/year
SalarySchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });

const BonusRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['perfect-attendance', 'overtime', 'referral', 'performance'], required: true },

  minAttendance: { type: Number, default: 100, min: 0, max: 100 },
  consecutiveMonths: { type: Number, default: 1, min: 1 },

  amountType: { type: String, enum: ['fixed', 'percentage'], required: true },
  amountValue: { type: Number, required: true, min: 0 },

  overtimeMultiplier: { type: Number, min: 0 },
  minOvertimeHours: { type: Number, min: 0 },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = {
  Salary: mongoose.model('Salary', SalarySchema),
  BonusRule: mongoose.model('BonusRule', BonusRuleSchema)
};
