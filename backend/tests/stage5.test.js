const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('STAGE 5: Loan & Advance Management', () => {
  const LoanService = require('../src/services/finance/LoanService');
  const Loan = require('../src/models/Loan');
  const User = require('../src/models/User');

  let testUser;

  beforeEach(async () => {
    testUser = await User.create({
      employeeId: 'EMP200',
      firstName: 'Loan',
      lastName: 'Tester',
      email: 'loan@test.com',
      department: 'HR',
      baseSalary: 5000
    });
  });

  test('module exports singleton with all methods', () => {
    expect(typeof LoanService.requestLoan).toBe('function');
    expect(typeof LoanService.approveLoan).toBe('function');
    expect(typeof LoanService.recordDeduction).toBe('function');
    expect(typeof LoanService.getUserLoans).toBe('function');
    expect(typeof LoanService.getLoanDetails).toBe('function');
    expect(typeof LoanService.getActiveLoansForDeduction).toBe('function');
    expect(typeof LoanService.markDefaultedLoans).toBe('function');
    expect(typeof LoanService.getLoanSummaryReport).toBe('function');
  });

  test('creates a loan request', async () => {
    const loan = await LoanService.requestLoan(
      testUser._id, 3000, 'Emergency', 6
    );
    expect(loan.amount).toBe(3000);
    expect(loan.totalInstallments).toBe(6);
    expect(loan.status).toBe('active');
    expect(loan.installmentAmount).toBe(500);
  });

  test('prevents duplicate active loans', async () => {
    await LoanService.requestLoan(testUser._id, 1000, 'First', 5);
    await expect(LoanService.requestLoan(testUser._id, 2000, 'Second', 5))
      .rejects.toThrow('already has an active loan');
  });

  test('rejects loan exceeding max amount (3x salary)', async () => {
    await expect(LoanService.requestLoan(testUser._id, 20000, 'Too much', 10))
      .rejects.toThrow('exceeds maximum');
  });

  test('rejects loan exceeding max installments (12)', async () => {
    await expect(LoanService.requestLoan(testUser._id, 1000, 'Long', 15))
      .rejects.toThrow('Maximum installment');
  });

  test('approves a loan', async () => {
    const loan = await LoanService.requestLoan(testUser._id, 1000, 'Test', 5);
    const admin = await User.create({
      employeeId: 'ADM001', firstName: 'Admin', lastName: 'User',
      email: 'admin@test.com', department: 'HR', role: 'admin'
    });

    const approved = await LoanService.approveLoan(loan._id, admin._id);
    expect(approved.approvedBy.toString()).toBe(admin._id.toString());
    expect(approved.approvedAt).toBeDefined();
  });

  test('records deductions and completes loan', async () => {
    const loan = await LoanService.requestLoan(testUser._id, 500, 'Test', 2);
    const fakeSalaryId = new (require('mongoose').Types.ObjectId)();

    // First deduction
    const after1 = await LoanService.recordDeduction(loan._id, fakeSalaryId, 4, 2026);
    expect(after1.installmentsPaid).toBe(1);
    expect(after1.status).toBe('active');

    // Second deduction - should complete
    const after2 = await LoanService.recordDeduction(loan._id, fakeSalaryId, 5, 2026);
    expect(after2.installmentsPaid).toBe(2);
    expect(after2.status).toBe('completed');
  });

  test('prevents duplicate deduction for same month', async () => {
    const loan = await LoanService.requestLoan(testUser._id, 1000, 'Test', 5);
    const fakeSalaryId = new (require('mongoose').Types.ObjectId)();
    await LoanService.recordDeduction(loan._id, fakeSalaryId, 4, 2026);
    await expect(LoanService.recordDeduction(loan._id, fakeSalaryId, 4, 2026))
      .rejects.toThrow('already recorded');
  });

  test('getUserLoans returns summary', async () => {
    await LoanService.requestLoan(testUser._id, 2000, 'Test', 4);
    const result = await LoanService.getUserLoans(testUser._id);
    expect(result.loans).toHaveLength(1);
    expect(result.summary.totalLoans).toBe(1);
    expect(result.summary.activeLoans).toBe(1);
    expect(result.summary.totalOutstanding).toBe(2000);
  });
});
