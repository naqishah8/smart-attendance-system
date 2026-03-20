const mongoose = require('mongoose');

const LoanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  amount: { type: Number, required: true, min: 1 },
  purpose: { type: String, trim: true, maxlength: 500 },
  interestRate: { type: Number, default: 0, min: 0, max: 100 },

  totalInstallments: { type: Number, required: true, min: 1, max: 60 },
  installmentAmount: { type: Number, min: 0 },
  installmentsPaid: { type: Number, default: 0, min: 0 },

  startMonth: { type: Number, required: true, min: 1, max: 12 },
  startYear: { type: Number, required: true },
  endMonth: { type: Number, min: 1, max: 12 },
  endYear: Number,

  status: {
    type: String,
    enum: ['active', 'completed', 'defaulted'],
    default: 'active'
  },

  deductions: [{
    salaryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salary' },
    amount: { type: Number, min: 0 },
    month: { type: Number, min: 1, max: 12 },
    year: Number,
    date: Date
  }],

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date
}, { timestamps: true });

LoanSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Loan', LoanSchema);
