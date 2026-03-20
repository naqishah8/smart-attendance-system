const mongoose = require('mongoose');

const LoanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Loan details
  amount: { type: Number, required: true },
  purpose: String,
  interestRate: { type: Number, default: 0 },

  // Repayment
  totalInstallments: { type: Number, required: true },
  installmentAmount: Number,
  installmentsPaid: { type: Number, default: 0 },

  // Schedule
  startMonth: { type: Number, required: true }, // 1-12
  startYear: { type: Number, required: true },
  endMonth: Number,
  endYear: Number,

  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'defaulted'],
    default: 'active'
  },

  // Deduction tracking
  deductions: [{
    salaryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salary' },
    amount: Number,
    month: Number,
    year: Number,
    date: Date
  }],

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Loan', LoanSchema);
