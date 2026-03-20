const path = require('path');
const fs = require('fs');

describe('STAGE 2: AI Service Implementation', () => {

  describe('FaceRecognitionService', () => {
    test('file exists and exports a singleton', () => {
      const filePath = path.join(__dirname, '../src/services/ai/FaceRecognitionService.js');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('class FaceRecognitionService');
      expect(content).toContain('module.exports = new FaceRecognitionService()');
    });

    test('has all required methods', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/ai/FaceRecognitionService.js'), 'utf8'
      );
      expect(content).toContain('async loadModels()');
      expect(content).toContain('async registerUserFace(');
      expect(content).toContain('async recognizeFace(');
      expect(content).toContain('async verifyLiveness(');
      expect(content).toContain('async detectPPE(');
      expect(content).toContain('async detectEmotion(');
      expect(content).toContain('async detectGait(');
      expect(content).toContain('_calculateEAR(');
    });

    test('uses face-api.js and tensorflow', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/ai/FaceRecognitionService.js'), 'utf8'
      );
      expect(content).toContain("require('face-api.js')");
      expect(content).toContain("require('@tensorflow/tfjs-node')");
    });
  });

  describe('ObjectDetectionService', () => {
    test('file exists and exports a singleton', () => {
      const filePath = path.join(__dirname, '../src/services/ai/ObjectDetectionService.js');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('class ObjectDetectionService');
      expect(content).toContain('module.exports = new ObjectDetectionService()');
    });

    test('has PPE detection method', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/ai/ObjectDetectionService.js'), 'utf8'
      );
      expect(content).toContain('async detectPPE(');
      expect(content).toContain('async detectTools(');
      expect(content).toContain('async loadModel()');
      expect(content).toContain('helmet');
      expect(content).toContain('vest');
      expect(content).toContain('goggles');
      expect(content).toContain('gloves');
    });
  });

  describe('LivenessDetectionService', () => {
    test('file exists and exports a singleton', () => {
      const filePath = path.join(__dirname, '../src/services/ai/LivenessDetectionService.js');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('class LivenessDetectionService');
      expect(content).toContain('module.exports = new LivenessDetectionService()');
    });

    test('has all liveness check methods', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/ai/LivenessDetectionService.js'), 'utf8'
      );
      expect(content).toContain('async detectLiveness(');
      expect(content).toContain('async detectMicroExpressions(');
      expect(content).toContain('detectHeadMovement(');
      expect(content).toContain('async analyzeTexture(');
      expect(content).toContain('async estimateDepth(');
    });

    test('liveness scoring combines multiple factors', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../src/services/ai/LivenessDetectionService.js'), 'utf8'
      );
      expect(content).toContain('hasMicroExpressions');
      expect(content).toContain('hasHeadMovement');
      expect(content).toContain('textureScore');
      expect(content).toContain('depthScore');
      expect(content).toContain('livenessScore > 0.7');
    });
  });
});
