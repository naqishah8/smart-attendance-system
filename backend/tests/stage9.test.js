const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

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

describe('STAGE 9: Privacy & Compliance', () => {
  const PrivacyService = require('../src/services/privacy/PrivacyService');
  const User = require('../src/models/User');
  const Attendance = require('../src/models/Attendance');
  const { Fine } = require('../src/models/Fine');

  test('module exports singleton with all methods', () => {
    expect(typeof PrivacyService.blurFaces).toBe('function');
    expect(typeof PrivacyService.anonymizeData).toBe('function');
    expect(typeof PrivacyService.exportUserData).toBe('function');
    expect(typeof PrivacyService.enforceRetentionPolicies).toBe('function');
    expect(typeof PrivacyService.getUserConsent).toBe('function');
    expect(typeof PrivacyService.updateUserConsent).toBe('function');
    expect(typeof PrivacyService.generatePrivacyAuditLog).toBe('function');
    expect(typeof PrivacyService.checkDataMinimization).toBe('function');
    expect(typeof PrivacyService.getRetentionPolicies).toBe('function');
    expect(typeof PrivacyService.updateRetentionPolicy).toBe('function');
  });

  test('has correct default retention policies', () => {
    const policies = PrivacyService.getRetentionPolicies();
    expect(policies.faceImages).toBe(90);
    expect(policies.videoFootage).toBe(30);
    expect(policies.detectionLogs).toBe(365);
  });

  test('updateRetentionPolicy works', () => {
    const result = PrivacyService.updateRetentionPolicy('faceImages', 60);
    expect(result.newRetentionDays).toBe(60);

    // Reset
    PrivacyService.updateRetentionPolicy('faceImages', 90);
  });

  test('updateRetentionPolicy rejects invalid category', () => {
    expect(() => PrivacyService.updateRetentionPolicy('invalid', 30))
      .toThrow('Unknown retention category');
  });

  test('updateRetentionPolicy rejects < 1 day', () => {
    expect(() => PrivacyService.updateRetentionPolicy('faceImages', 0))
      .toThrow('at least 1 day');
  });

  test('anonymizeData wipes user PII', async () => {
    const user = await User.create({
      employeeId: 'EMP300', firstName: 'Privacy', lastName: 'Test',
      email: 'privacy@test.com', department: 'HR', phone: '1234567890',
      faceEmbeddings: [{ vector: [0.1, 0.2], captureDate: new Date() }],
      bankAccount: { accountNumber: '123456', bankName: 'TestBank', ifscCode: 'TEST' }
    });

    const result = await PrivacyService.anonymizeData(user._id);
    expect(result.success).toBe(true);

    const anonymized = await User.findById(user._id);
    expect(anonymized.firstName).toBe('ANONYMIZED');
    expect(anonymized.lastName).toBe('ANONYMIZED');
    expect(anonymized.email).toContain('anonymized.com');
    expect(anonymized.phone).toBeNull();
    expect(anonymized.faceEmbeddings).toHaveLength(0);
    expect(anonymized.bankAccount.accountNumber).toBeNull();
    expect(anonymized.isActive).toBe(false);
  });

  test('exportUserData returns complete user data', async () => {
    const user = await User.create({
      employeeId: 'EMP301', firstName: 'Export', lastName: 'Test',
      email: 'export@test.com', department: 'HR'
    });

    await Attendance.create({
      userId: user._id, date: new Date(), status: 'present',
      detections: [{ timestamp: new Date(), cameraId: 'CAM1', confidence: 0.9 }]
    });

    const data = await PrivacyService.exportUserData(user._id);
    expect(data.user).toBeDefined();
    expect(data.attendance).toHaveLength(1);
    expect(data.user.faceEmbeddings).toBeUndefined(); // Sensitive data removed
    expect(data.exportDate).toBeDefined();
  });

  test('checkDataMinimization returns only required features', async () => {
    const result = await PrivacyService.checkDataMinimization(null, ['face', 'ppe']);
    expect(result.faceDetection).toBe(true);
    expect(result.ppeDetection).toBe(true);
    expect(result.emotionAnalysis).toBe(false);
    expect(result.locationData).toBe(false);
  });

  test('generatePrivacyAuditLog works', async () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-12-31');
    const log = await PrivacyService.generatePrivacyAuditLog(start, end);
    expect(log.period).toBeDefined();
    expect(log.generatedAt).toBeDefined();
    expect(typeof log.anonymizationRequests).toBe('number');
  });
});
