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

describe('STAGE 1: Core Database Models', () => {

  describe('User Model', () => {
    const User = require('../src/models/User');

    test('creates a user with required fields', async () => {
      const user = await User.create({
        employeeId: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        department: 'Engineering'
      });
      expect(user._id).toBeDefined();
      expect(user.employeeId).toBe('EMP001');
      expect(user.isActive).toBe(true);
      expect(user.role).toBe('employee');
    });

    test('fails without required fields', async () => {
      await expect(User.create({ firstName: 'John' }))
        .rejects.toThrow();
    });

    test('enforces unique employeeId', async () => {
      await User.create({
        employeeId: 'EMP002', firstName: 'A', lastName: 'B',
        email: 'a@test.com', department: 'HR'
      });
      await expect(User.create({
        employeeId: 'EMP002', firstName: 'C', lastName: 'D',
        email: 'c@test.com', department: 'HR'
      })).rejects.toThrow();
    });

    test('enforces unique email', async () => {
      await User.create({
        employeeId: 'EMP003', firstName: 'A', lastName: 'B',
        email: 'dup@test.com', department: 'HR'
      });
      await expect(User.create({
        employeeId: 'EMP004', firstName: 'C', lastName: 'D',
        email: 'dup@test.com', department: 'HR'
      })).rejects.toThrow();
    });

    test('stores face embeddings', async () => {
      const user = await User.create({
        employeeId: 'EMP005', firstName: 'A', lastName: 'B',
        email: 'face@test.com', department: 'HR',
        faceEmbeddings: [{ vector: [0.1, 0.2, 0.3], captureDate: new Date() }]
      });
      expect(user.faceEmbeddings).toHaveLength(1);
      expect(user.faceEmbeddings[0].vector).toEqual([0.1, 0.2, 0.3]);
    });

    test('validates role enum', async () => {
      await expect(User.create({
        employeeId: 'EMP006', firstName: 'A', lastName: 'B',
        email: 'role@test.com', department: 'HR', role: 'invalid'
      })).rejects.toThrow();
    });
  });

  describe('Shift Model', () => {
    const { Shift, UserShift } = require('../src/models/Shift');
    const User = require('../src/models/User');

    test('creates a shift', async () => {
      const shift = await Shift.create({
        name: 'Morning',
        startTime: '08:00',
        endTime: '17:00',
        workingDays: [1, 2, 3, 4, 5]
      });
      expect(shift.name).toBe('Morning');
      expect(shift.gracePeriod).toBe(15);
      expect(shift.overtimeRate).toBe(1.5);
    });

    test('creates a user-shift assignment', async () => {
      const user = await User.create({
        employeeId: 'EMP010', firstName: 'A', lastName: 'B',
        email: 'shift@test.com', department: 'HR'
      });
      const shift = await Shift.create({
        name: 'Evening', startTime: '14:00', endTime: '22:00'
      });
      const userShift = await UserShift.create({
        userId: user._id,
        shiftId: shift._id,
        effectiveFrom: new Date()
      });
      expect(userShift.userId.toString()).toBe(user._id.toString());
    });
  });

  describe('Attendance Model', () => {
    const Attendance = require('../src/models/Attendance');
    const User = require('../src/models/User');

    test('creates attendance record with detections', async () => {
      const user = await User.create({
        employeeId: 'EMP020', firstName: 'A', lastName: 'B',
        email: 'att@test.com', department: 'HR'
      });
      const attendance = await Attendance.create({
        userId: user._id,
        date: new Date(),
        detections: [{
          timestamp: new Date(),
          cameraId: 'CAM001',
          confidence: 0.95,
          livenessScore: 0.9,
          emotion: 'neutral',
          ppeCompliance: { helmet: true, vest: true, goggles: false, gloves: false }
        }],
        status: 'present'
      });
      expect(attendance.detections).toHaveLength(1);
      expect(attendance.status).toBe('present');
    });

    test('validates status enum', async () => {
      const user = await User.create({
        employeeId: 'EMP021', firstName: 'A', lastName: 'B',
        email: 'att2@test.com', department: 'HR'
      });
      await expect(Attendance.create({
        userId: user._id, date: new Date(), status: 'invalid'
      })).rejects.toThrow();
    });
  });

  describe('Fine Model', () => {
    const { Fine, FineRule } = require('../src/models/Fine');

    test('creates a fine rule', async () => {
      const rule = await FineRule.create({
        name: 'Late Fine',
        category: 'late',
        condition: { threshold: 15, comparison: 'gt' },
        amountType: 'fixed',
        amountValue: 50
      });
      expect(rule.name).toBe('Late Fine');
      expect(rule.isActive).toBe(true);
    });

    test('creates a fine', async () => {
      const User = require('../src/models/User');
      const user = await User.create({
        employeeId: 'EMP030', firstName: 'A', lastName: 'B',
        email: 'fine@test.com', department: 'HR'
      });
      const fine = await Fine.create({
        userId: user._id,
        type: { category: 'late' },
        amount: 50
      });
      expect(fine.status).toBe('pending');
      expect(fine.amount).toBe(50);
    });
  });

  describe('Salary Model', () => {
    const { Salary, BonusRule } = require('../src/models/Salary');

    test('creates a salary record', async () => {
      const User = require('../src/models/User');
      const user = await User.create({
        employeeId: 'EMP040', firstName: 'A', lastName: 'B',
        email: 'sal@test.com', department: 'HR'
      });
      const salary = await Salary.create({
        userId: user._id,
        month: 3,
        year: 2026,
        baseSalary: 5000
      });
      expect(salary.paymentStatus).toBe('pending');
    });

    test('creates a bonus rule', async () => {
      const rule = await BonusRule.create({
        name: 'Perfect Attendance',
        type: 'perfect-attendance',
        amountType: 'fixed',
        amountValue: 200
      });
      expect(rule.minAttendance).toBe(100);
    });
  });

  describe('Loan Model', () => {
    const Loan = require('../src/models/Loan');

    test('creates a loan', async () => {
      const User = require('../src/models/User');
      const user = await User.create({
        employeeId: 'EMP050', firstName: 'A', lastName: 'B',
        email: 'loan@test.com', department: 'HR'
      });
      const loan = await Loan.create({
        userId: user._id,
        amount: 5000,
        totalInstallments: 10,
        startMonth: 4,
        startYear: 2026
      });
      expect(loan.status).toBe('active');
      expect(loan.installmentsPaid).toBe(0);
    });
  });

  describe('Camera Model', () => {
    const Camera = require('../src/models/Camera');

    test('creates a camera', async () => {
      const camera = await Camera.create({
        name: 'Main Entrance',
        rtspUrl: 'rtsp://192.168.1.100:554/stream',
        location: { zone: 'Entrance', floor: 1 }
      });
      expect(camera.status).toBe('offline');
      expect(camera.hasPTZ).toBe(false);
    });

    test('fails without rtspUrl', async () => {
      await expect(Camera.create({ name: 'No URL' }))
        .rejects.toThrow();
    });
  });
});
