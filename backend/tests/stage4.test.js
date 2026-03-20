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

describe('STAGE 4: Finance & Fine Engine', () => {

  describe('FineService', () => {
    const FineService = require('../src/services/finance/FineService');
    const { Fine, FineRule } = require('../src/models/Fine');
    const User = require('../src/models/User');
    const Attendance = require('../src/models/Attendance');

    test('module exports a singleton', () => {
      expect(FineService).toBeDefined();
      expect(typeof FineService.checkForFines).toBe('function');
      expect(typeof FineService.applyAbsentFine).toBe('function');
      expect(typeof FineService.disputeFine).toBe('function');
      expect(typeof FineService.resolveFineDispute).toBe('function');
      expect(typeof FineService.getUserFines).toBe('function');
    });

    test('creates fine for late arrival', async () => {
      const user = await User.create({
        employeeId: 'EMP100', firstName: 'A', lastName: 'B',
        email: 'fine1@test.com', department: 'HR', baseSalary: 5000
      });

      const rule = await FineRule.create({
        name: 'Late Fine', category: 'late',
        condition: { threshold: 15, comparison: 'gt' },
        amountType: 'fixed', amountValue: 50,
        isActive: true
      });

      const attendance = await Attendance.create({
        userId: user._id, date: new Date(), status: 'late',
        detections: [{ timestamp: new Date(), cameraId: 'CAM1', confidence: 0.9 }],
        shiftCompliance: { wasLate: true, lateMinutes: 30 }
      });

      await FineService.checkForFines(attendance);

      const fines = await Fine.find({ userId: user._id });
      expect(fines.length).toBeGreaterThan(0);
      expect(fines[0].amount).toBe(50);
    });

    test('respects daily fine limit', async () => {
      const user = await User.create({
        employeeId: 'EMP101', firstName: 'A', lastName: 'B',
        email: 'fine2@test.com', department: 'HR', baseSalary: 5000
      });

      const rule = await FineRule.create({
        name: 'Late Fine 2', category: 'late',
        condition: { threshold: 5, comparison: 'gt' },
        amountType: 'fixed', amountValue: 25,
        maxPerDay: 1, isActive: true
      });

      const attendance = await Attendance.create({
        userId: user._id, date: new Date(), status: 'late',
        detections: [{ timestamp: new Date(), cameraId: 'CAM1', confidence: 0.9 }],
        shiftCompliance: { wasLate: true, lateMinutes: 30 }
      });

      // Apply twice
      await FineService.checkForFines(attendance);
      await FineService.checkForFines(attendance);

      const fines = await Fine.find({ userId: user._id, 'type.ruleId': rule._id });
      expect(fines.length).toBe(1); // Only 1 due to maxPerDay
    });

    test('dispute and resolve fine', async () => {
      const user = await User.create({
        employeeId: 'EMP102', firstName: 'A', lastName: 'B',
        email: 'fine3@test.com', department: 'HR'
      });

      const fine = await Fine.create({
        userId: user._id, type: { category: 'late' },
        amount: 50, status: 'pending'
      });

      const disputed = await FineService.disputeFine(fine._id, 'Traffic jam');
      expect(disputed.status).toBe('disputed');
      expect(disputed.dispute.reason).toBe('Traffic jam');

      const resolved = await FineService.resolveFineDispute(fine._id, 'Accepted - one time', true);
      expect(resolved.status).toBe('waived');
    });

    test('generates fine description', () => {
      expect(FineService.generateDescription({ type: 'late', minutes: 20 }))
        .toContain('Late arrival');
      expect(FineService.generateDescription({ type: 'absent' }))
        .toContain('Absent');
      expect(FineService.generateDescription({ type: 'ppe-violation', missingPPE: ['helmet'] }))
        .toContain('helmet');
    });
  });

  describe('SalaryService', () => {
    const fs = require('fs');
    const path = require('path');

    test('file exists and has required methods', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/finance/SalaryService.js'), 'utf8'
      );
      expect(content).toContain('class SalaryService');
      expect(content).toContain('async calculateMonthlySalary(');
      expect(content).toContain('async calculateBonuses(');
      expect(content).toContain('async getLoanDeductions(');
      expect(content).toContain('calculateTax(');
      expect(content).toContain('getWorkingDays(');
      expect(content).toContain('async generatePayslip(');
      expect(content).toContain('async processAllSalaries(');
    });

    test('SalaryService tax calculation logic', () => {
      const SalaryService = require('../src/services/finance/SalaryService');
      expect(SalaryService.calculateTax(0)).toBe(0);
      expect(SalaryService.calculateTax(200000)).toBe(0);
      expect(SalaryService.calculateTax(300000)).toBe(2500); // (300k-250k)*0.05
      expect(SalaryService.calculateTax(-100)).toBe(0);
    });

    test('SalaryService getWorkingDays returns correct count', () => {
      const SalaryService = require('../src/services/finance/SalaryService');
      // March 2026 has 22 working days (Mon-Fri)
      const days = SalaryService.getWorkingDays(3, 2026);
      expect(days).toBe(22);
    });
  });
});
