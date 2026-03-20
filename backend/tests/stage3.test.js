const path = require('path');
const fs = require('fs');

describe('STAGE 3: CCTV Stream Processing', () => {

  describe('StreamProcessor', () => {
    test('file exists and exports singleton', () => {
      const filePath = path.join(__dirname, '../src/services/StreamProcessor.js');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('class StreamProcessor');
      expect(content).toContain('module.exports = new StreamProcessor()');
    });

    test('extends EventEmitter', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/StreamProcessor.js'), 'utf8'
      );
      expect(content).toContain('extends EventEmitter');
      expect(content).toContain("require('events')");
    });

    test('has camera connection methods', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/StreamProcessor.js'), 'utf8'
      );
      expect(content).toContain('async connectCamera(');
      expect(content).toContain('disconnectCamera(');
      expect(content).toContain('async getLatestFrame(');
    });

    test('has frame processing pipeline', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/StreamProcessor.js'), 'utf8'
      );
      expect(content).toContain('startFrameProcessing(');
      expect(content).toContain('async processFrame(');
      expect(content).toContain('async captureFrame(');
    });

    test('processes face, liveness, PPE, emotion in pipeline', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/StreamProcessor.js'), 'utf8'
      );
      expect(content).toContain('FaceRecognitionService.recognizeFace');
      expect(content).toContain('LivenessService.detectLiveness');
      expect(content).toContain('ObjectDetectionService.detectPPE');
      expect(content).toContain('FaceRecognitionService.detectEmotion');
    });

    test('emits events for detections and spoofs', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/StreamProcessor.js'), 'utf8'
      );
      expect(content).toContain("this.emit('face-detected'");
      expect(content).toContain("this.emit('spoof-detected'");
    });
  });

  describe('AttendanceService', () => {
    test('file exists and exports singleton', () => {
      const filePath = path.join(__dirname, '../src/services/attendance/AttendanceService.js');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('class AttendanceService');
      expect(content).toContain('module.exports = new AttendanceService()');
    });

    test('has all required methods', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/attendance/AttendanceService.js'), 'utf8'
      );
      expect(content).toContain('async recordDetection(');
      expect(content).toContain('async updateAttendanceMetrics(');
      expect(content).toContain('async determineStatus(');
      expect(content).toContain('async getAttendanceReport(');
      expect(content).toContain('async markAbsentUsers(');
    });

    test('calculates work hours and breaks', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/attendance/AttendanceService.js'), 'utf8'
      );
      expect(content).toContain('totalWorkHours');
      expect(content).toContain('breakHours');
      expect(content).toContain('effectiveWorkHours');
      // 30 minute gap detection for breaks
      expect(content).toContain('30 * 60 * 1000');
    });

    test('handles shift compliance (late, early departure, overtime)', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/attendance/AttendanceService.js'), 'utf8'
      );
      expect(content).toContain('wasLate');
      expect(content).toContain('lateMinutes');
      expect(content).toContain('wasEarlyDeparture');
      expect(content).toContain('overtimeHours');
    });
  });
});
