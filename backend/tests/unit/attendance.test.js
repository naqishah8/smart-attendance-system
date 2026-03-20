const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const AttendanceService = require('../../src/services/attendance/AttendanceService');
const Attendance = require('../../src/models/Attendance');
const User = require('../../src/models/User');
const { Shift, UserShift } = require('../../src/models/Shift');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Attendance.deleteMany({});
  await User.deleteMany({});
  await Shift.deleteMany({});
  await UserShift.deleteMany({});
});

// Helper to create a test user
const createTestUser = (overrides = {}) => {
  return User.create({
    employeeId: `EMP${Date.now()}`,
    firstName: 'John',
    lastName: 'Doe',
    email: `john${Date.now()}@example.com`,
    department: 'Engineering',
    ...overrides
  });
};

// Helper to make a date with specific hours, keeping the same day
const todayAt = (hours, minutes = 0) => {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
};

describe('AttendanceService', () => {

  describe('recordDetection', () => {

    it('should create new attendance record for first detection', async () => {
      const user = await createTestUser();

      const result = await AttendanceService.recordDetection({
        userId: user._id,
        cameraId: 'cam123',
        timestamp: new Date(),
        livenessScore: 0.95,
        ppeCompliance: { helmet: true, vest: true, goggles: true, gloves: true },
        confidence: 0.98
      });

      expect(result).toBeDefined();
      expect(result.userId.toString()).toBe(user._id.toString());
      expect(result.detections).toHaveLength(1);
      expect(result.firstDetection).toBeDefined();
      expect(result.status).toBe('present');
    });

    it('should add detection to existing attendance record', async () => {
      const user = await createTestUser();
      const morningTime = todayAt(9, 0);

      // Create initial attendance with one detection
      await Attendance.create({
        userId: user._id,
        date: todayAt(0, 0), // start of today
        detections: [{
          timestamp: morningTime,
          cameraId: 'cam123',
          confidence: 0.98
        }],
        firstDetection: morningTime
      });

      // Record a second detection in the afternoon
      const afternoonTime = todayAt(17, 0);
      const updated = await AttendanceService.recordDetection({
        userId: user._id,
        cameraId: 'cam123',
        timestamp: afternoonTime,
        livenessScore: 0.95,
        confidence: 0.98
      });

      expect(updated.detections).toHaveLength(2);
      expect(updated.lastDetection).toBeDefined();
      expect(new Date(updated.lastDetection).getHours()).toBe(17);
    });

    it('should reject detection with missing required fields', async () => {
      await expect(AttendanceService.recordDetection({
        userId: null,
        cameraId: 'cam123',
        timestamp: new Date()
      })).rejects.toThrow('Missing required fields');
    });

    it('should store PPE compliance data', async () => {
      const user = await createTestUser();

      const result = await AttendanceService.recordDetection({
        userId: user._id,
        cameraId: 'cam123',
        timestamp: new Date(),
        livenessScore: 0.9,
        ppeCompliance: { helmet: true, vest: false, goggles: true, gloves: false },
        confidence: 0.95
      });

      const detection = result.detections[0];
      expect(detection.ppeCompliance.helmet).toBe(true);
      expect(detection.ppeCompliance.vest).toBe(false);
    });
  });

  describe('updateAttendanceMetrics', () => {

    it('should calculate correct work hours and detect breaks', async () => {
      const user = await createTestUser();

      // Simulate detections every 20 min, with a 1-hour lunch gap (12:00-13:00)
      // Morning: 9:00, 9:20, 9:40, 10:00, 10:20, 10:40, 11:00, 11:20, 11:40, 12:00
      // (gap: 12:00 → 13:00 = 60 min > 30 min threshold → break)
      // Afternoon: 13:00, 13:20, 13:40, 14:00, ..., 17:00
      const detections = [];
      for (let h = 9; h <= 12; h++) {
        for (let m = 0; m < 60; m += 20) {
          if (h === 12 && m > 0) break; // Stop at 12:00
          detections.push({ timestamp: todayAt(h, m), cameraId: 'c1', confidence: 0.9 });
        }
      }
      for (let h = 13; h <= 17; h++) {
        for (let m = 0; m < 60; m += 20) {
          if (h === 17 && m > 0) break; // Stop at 17:00
          detections.push({ timestamp: todayAt(h, m), cameraId: 'c1', confidence: 0.9 });
        }
      }

      const attendance = await Attendance.create({
        userId: user._id,
        date: todayAt(0, 0),
        detections
      });

      await AttendanceService.updateAttendanceMetrics(attendance);

      expect(attendance.totalWorkHours).toBe(8);
      // Only the 12:00→13:00 gap exceeds 30 min
      expect(attendance.breakHours).toBe(1);
      expect(attendance.effectiveWorkHours).toBe(7);
    });

    it('should handle single detection (no breaks)', async () => {
      const user = await createTestUser();
      const now = new Date();

      const attendance = await Attendance.create({
        userId: user._id,
        date: todayAt(0, 0),
        detections: [
          { timestamp: now, cameraId: 'c1', confidence: 0.9 }
        ]
      });

      await AttendanceService.updateAttendanceMetrics(attendance);

      expect(attendance.totalWorkHours).toBe(0);
      expect(attendance.breakHours).toBe(0);
      expect(attendance.effectiveWorkHours).toBe(0);
    });

    it('should handle empty detections gracefully', async () => {
      const user = await createTestUser();

      const attendance = await Attendance.create({
        userId: user._id,
        date: todayAt(0, 0),
        detections: []
      });

      // Should not throw
      await AttendanceService.updateAttendanceMetrics(attendance);
      expect(attendance.firstDetection).toBeUndefined();
    });
  });

  describe('determineStatus', () => {

    it('should mark as present when no shift assigned', async () => {
      const user = await createTestUser();

      const attendance = await Attendance.create({
        userId: user._id,
        date: todayAt(0, 0),
        detections: [{ timestamp: todayAt(9, 0), cameraId: 'c1', confidence: 0.9 }],
        firstDetection: todayAt(9, 0),
        lastDetection: todayAt(17, 0),
        effectiveWorkHours: 8
      });

      await AttendanceService.determineStatus(attendance);
      expect(attendance.status).toBe('present');
    });

    it('should mark as late when arriving after shift start + grace period', async () => {
      const shift = await Shift.create({
        name: 'Morning',
        startTime: '09:00',
        endTime: '17:00',
        gracePeriod: 15,
        workingDays: [1, 2, 3, 4, 5]
      });

      const user = await createTestUser();

      // Arrive at 9:30 → 30 min after shift start → exceeds 15 min grace
      const attendance = await Attendance.create({
        userId: user._id,
        date: todayAt(0, 0),
        shiftId: shift._id,
        firstDetection: todayAt(9, 30),
        lastDetection: todayAt(17, 0),
        effectiveWorkHours: 7.5,
        detections: [
          { timestamp: todayAt(9, 30), cameraId: 'c1', confidence: 0.9 },
          { timestamp: todayAt(17, 0), cameraId: 'c1', confidence: 0.9 }
        ]
      });

      await AttendanceService.determineStatus(attendance);

      expect(attendance.shiftCompliance.wasLate).toBe(true);
      // lateMinutes = diff from shift start (9:00), not from grace end
      expect(attendance.shiftCompliance.lateMinutes).toBe(30);
      expect(attendance.status).toBe('late');
    });

    it('should mark as present when arriving within grace period', async () => {
      const shift = await Shift.create({
        name: 'Morning',
        startTime: '09:00',
        endTime: '17:00',
        gracePeriod: 15
      });

      const user = await createTestUser();

      // Arrive at 9:10 → within 15 min grace
      const attendance = await Attendance.create({
        userId: user._id,
        date: todayAt(0, 0),
        shiftId: shift._id,
        firstDetection: todayAt(9, 10),
        lastDetection: todayAt(17, 0),
        effectiveWorkHours: 7.8,
        detections: [
          { timestamp: todayAt(9, 10), cameraId: 'c1', confidence: 0.9 },
          { timestamp: todayAt(17, 0), cameraId: 'c1', confidence: 0.9 }
        ]
      });

      await AttendanceService.determineStatus(attendance);

      expect(attendance.shiftCompliance?.wasLate).toBeFalsy();
      expect(attendance.status).toBe('present');
    });

    it('should detect overtime', async () => {
      const shift = await Shift.create({
        name: 'Morning',
        startTime: '09:00',
        endTime: '17:00',
        gracePeriod: 15
      });

      const user = await createTestUser();

      // Leave at 19:00 → 2 hours overtime
      const attendance = await Attendance.create({
        userId: user._id,
        date: todayAt(0, 0),
        shiftId: shift._id,
        firstDetection: todayAt(9, 0),
        lastDetection: todayAt(19, 0),
        effectiveWorkHours: 10,
        detections: [
          { timestamp: todayAt(9, 0), cameraId: 'c1', confidence: 0.9 },
          { timestamp: todayAt(19, 0), cameraId: 'c1', confidence: 0.9 }
        ]
      });

      await AttendanceService.determineStatus(attendance);

      expect(attendance.shiftCompliance.overtimeHours).toBeCloseTo(2, 0);
      expect(attendance.status).toBe('present');
    });

    it('should mark as half-day when working less than 4 hours', async () => {
      const shift = await Shift.create({
        name: 'Morning',
        startTime: '09:00',
        endTime: '17:00',
        gracePeriod: 15
      });

      const user = await createTestUser();

      const attendance = await Attendance.create({
        userId: user._id,
        date: todayAt(0, 0),
        shiftId: shift._id,
        firstDetection: todayAt(9, 0),
        lastDetection: todayAt(12, 0),
        effectiveWorkHours: 3,
        detections: [
          { timestamp: todayAt(9, 0), cameraId: 'c1', confidence: 0.9 },
          { timestamp: todayAt(12, 0), cameraId: 'c1', confidence: 0.9 }
        ]
      });

      await AttendanceService.determineStatus(attendance);

      expect(attendance.status).toBe('half-day');
    });
  });

  describe('getAttendanceReport', () => {

    it('should return attendance records with summary', async () => {
      const user = await createTestUser();
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Create several attendance records
      await Attendance.create([
        { userId: user._id, date: new Date(today.getFullYear(), today.getMonth(), 1), status: 'present', detections: [], effectiveWorkHours: 8 },
        { userId: user._id, date: new Date(today.getFullYear(), today.getMonth(), 2), status: 'present', detections: [], effectiveWorkHours: 7.5 },
        { userId: user._id, date: new Date(today.getFullYear(), today.getMonth(), 3), status: 'late', detections: [], effectiveWorkHours: 7 },
        { userId: user._id, date: new Date(today.getFullYear(), today.getMonth(), 4), status: 'absent', detections: [] }
      ]);

      const report = await AttendanceService.getAttendanceReport(
        user._id, startOfMonth, today
      );

      expect(report.attendances).toHaveLength(4);
      expect(report.summary.present).toBe(2);
      expect(report.summary.late).toBe(1);
      expect(report.summary.absent).toBe(1);
      expect(report.summary.totalWorkHours).toBe(22.5);
      expect(report.summary.averageWorkHours).toBeCloseTo(5.625, 2);
    });

    it('should require userId', async () => {
      await expect(AttendanceService.getAttendanceReport(null, new Date(), new Date()))
        .rejects.toThrow('userId is required');
    });
  });

  describe('markAbsentUsers', () => {

    it('should create absent records for users with no attendance yesterday', async () => {
      const user1 = await createTestUser({ employeeId: 'EMP_PRESENT', email: 'p@t.com' });
      const user2 = await createTestUser({ employeeId: 'EMP_ABSENT', email: 'a@t.com' });

      // user1 has attendance yesterday, user2 does not
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      await Attendance.create({
        userId: user1._id,
        date: yesterday,
        status: 'present',
        detections: [{ timestamp: yesterday, cameraId: 'c1', confidence: 0.9 }]
      });

      await AttendanceService.markAbsentUsers();

      // user2 should now have an absent record
      const absentRecord = await Attendance.findOne({ userId: user2._id });
      expect(absentRecord).toBeDefined();
      expect(absentRecord.status).toBe('absent');
      expect(absentRecord.detections).toHaveLength(0);
    });
  });
});
