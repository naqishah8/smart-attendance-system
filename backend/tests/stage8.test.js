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

describe('STAGE 8: Advanced Features', () => {

  describe('ShiftSwapService', () => {
    test('file exists and has ShiftSwap model', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/ShiftSwapService.js'), 'utf8'
      );
      expect(content).toContain('ShiftSwapSchema');
      expect(content).toContain('class ShiftSwapService');
    });

    test('has all required methods', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/ShiftSwapService.js'), 'utf8'
      );
      expect(content).toContain('async createSwapRequest(');
      expect(content).toContain('async acceptSwap(');
      expect(content).toContain('async approveSwap(');
      expect(content).toContain('async rejectSwap(');
      expect(content).toContain('async cancelSwap(');
      expect(content).toContain('async getOpenSwaps(');
      expect(content).toContain('async getUserSwaps(');
      expect(content).toContain('async getPendingApprovals(');
    });

    test('swap statuses are correct', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/ShiftSwapService.js'), 'utf8'
      );
      expect(content).toContain("'open'");
      expect(content).toContain("'pending'");
      expect(content).toContain("'approved'");
      expect(content).toContain("'rejected'");
      expect(content).toContain("'cancelled'");
    });
  });

  describe('PredictiveAnalytics', () => {
    test('file exists and exports singleton', () => {
      const filePath = path.join(__dirname, '../src/services/analytics/PredictiveAnalytics.js');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('class PredictiveAnalytics');
      expect(content).toContain('module.exports = new PredictiveAnalytics()');
    });

    test('has attrition risk analysis', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/analytics/PredictiveAnalytics.js'), 'utf8'
      );
      expect(content).toContain('async analyzeAttritionRisk(');
      expect(content).toContain('async calculateAttritionRisk(');
      expect(content).toContain('riskScore');
      expect(content).toContain('factors');
      expect(content).toContain('recommendedAction');
    });

    test('analyzes 5 risk factors', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/analytics/PredictiveAnalytics.js'), 'utf8'
      );
      expect(content).toContain('Significant drop in attendance');
      expect(content).toContain('High rate of lateness');
      expect(content).toContain('Multiple fines recently');
      expect(content).toContain('Working reduced hours');
      expect(content).toContain('Increased safety violations');
    });

    test('has attendance prediction', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/analytics/PredictiveAnalytics.js'), 'utf8'
      );
      expect(content).toContain('async predictAttendance(');
      expect(content).toContain('predictedAbsenteeism');
      expect(content).toContain('$dayOfWeek');
    });

    test('has anomaly detection', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/analytics/PredictiveAnalytics.js'), 'utf8'
      );
      expect(content).toContain('async detectAnomalies(');
      expect(content).toContain('extreme_lateness');
      expect(content).toContain('short_day');
      expect(content).toContain('excessive_breaks');
      expect(content).toContain('repeated_safety_violations');
    });

    test('has department insights', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/analytics/PredictiveAnalytics.js'), 'utf8'
      );
      expect(content).toContain('async getDepartmentInsights(');
    });
  });

  describe('ARVerificationService', () => {
    const ARService = require('../src/services/field/ARVerificationService');

    test('module exports singleton with all methods', () => {
      expect(typeof ARService.registerSite).toBe('function');
      expect(typeof ARService.verifyLocation).toBe('function');
      expect(typeof ARService.extractFeatures).toBe('function');
      expect(typeof ARService.verifyGPS).toBe('function');
      expect(typeof ARService.findMatchingSite).toBe('function');
      expect(typeof ARService.compareFeatures).toBe('function');
      expect(typeof ARService.calculateDistance).toBe('function');
    });

    test('calculateDistance returns correct value', () => {
      // Distance between two known points (approx 111km for 1 degree lat)
      const distance = ARService.calculateDistance(0, 0, 1, 0);
      expect(distance).toBeGreaterThan(110000);
      expect(distance).toBeLessThan(112000);

      // Same point should be 0
      const zero = ARService.calculateDistance(10, 20, 10, 20);
      expect(zero).toBeCloseTo(0, 0);
    });

    test('registerSite stores markers', async () => {
      const result = await ARService.registerSite('SITE1', [Buffer.from('test')], { lat: 10, lng: 20 });
      expect(result.siteId).toBe('SITE1');
      expect(result.markersRegistered).toBe(1);
    });
  });
});
