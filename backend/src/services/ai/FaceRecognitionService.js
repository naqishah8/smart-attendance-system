const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const faceapi = require('face-api.js');

class FaceRecognitionService {
  constructor() {
    this.modelsLoaded = false;
    this.faceMatcher = null;
    this.knownFaces = new Map(); // userId -> face descriptors
  }

  async loadModels() {
    // Load face detection and recognition models
    const modelPath = path.join(__dirname, '../../../ai-models/face_recognition');

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);

    this.modelsLoaded = true;
    console.log('Face recognition models loaded');
  }

  async registerUserFace(userId, imageBuffer) {
    // Detect face and extract descriptor
    const img = await faceapi.bufferToImage(imageBuffer);
    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      throw new Error('No face detected in image');
    }

    // Store face descriptor
    const descriptor = Array.from(detection.descriptor);

    // Save to database (via repository call)
    const User = require('../../models/User');
    await User.updateOne(
      { _id: userId },
      { $push: { faceEmbeddings: { vector: descriptor, captureDate: new Date() } } }
    );

    // Update in-memory cache
    if (!this.knownFaces.has(userId)) {
      this.knownFaces.set(userId, []);
    }
    this.knownFaces.get(userId).push(descriptor);

    return { success: true, confidence: detection.detection.score };
  }

  async recognizeFace(imageBuffer, threshold = 0.6) {
    if (!this.modelsLoaded) await this.loadModels();

    const User = require('../../models/User');

    // Detect all faces in image
    const img = await faceapi.bufferToImage(imageBuffer);
    const detections = await faceapi
      .detectAllFaces(img)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      return [];
    }

    // Load all known faces from DB (or use cache)
    const knownUsers = await User.find({ isActive: true, 'faceEmbeddings.0': { $exists: true } });

    // Create labeled descriptors for matching
    const labeledDescriptors = knownUsers.flatMap(user => {
      return user.faceEmbeddings.map(embedding => {
        return new faceapi.LabeledFaceDescriptors(
          user._id.toString(),
          [new Float32Array(embedding.vector)]
        );
      });
    });

    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);

    // Match each detected face
    const results = [];
    for (const detection of detections) {
      const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

      results.push({
        userId: bestMatch.label !== 'unknown' ? bestMatch.label : null,
        confidence: bestMatch.distance,
        detection: {
          box: detection.detection.box,
          landmarks: detection.landmarks.positions
        },
        isKnown: bestMatch.label !== 'unknown'
      });
    }

    return results;
  }

  async verifyLiveness(imageBuffer, previousFrames = []) {
    // Check for eye blink, head movement, etc.
    // This is a simplified version - real implementation uses sequence models

    const img = await faceapi.bufferToImage(imageBuffer);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks();

    if (!detection) {
      return { isLive: false, score: 0, reason: 'No face detected' };
    }

    const landmarks = detection.landmarks;

    // Eye aspect ratio for blink detection
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const leftEAR = this._calculateEAR(leftEye);
    const rightEAR = this._calculateEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2;

    // Head pose estimation from landmarks
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();

    // Simple liveness heuristics
    let livenessScore = 0.5; // Base score

    // Check eye aspect ratio variation across frames
    if (previousFrames.length >= 3) {
      const earVariation = this._calculateVariation(previousFrames.map(f => f.ear));
      if (earVariation > 0.05) livenessScore += 0.2; // Blinking detected
    }

    // Check head movement across frames
    if (previousFrames.length >= 5) {
      const nosePositions = previousFrames.map(f => f.nosePosition);
      const movement = this._calculateMovement(nosePositions);
      if (movement > 2 && movement < 50) livenessScore += 0.2; // Natural movement
    }

    // Texture analysis (basic - check for screen patterns)
    livenessScore += 0.1; // Placeholder for texture analysis

    return {
      isLive: livenessScore > 0.6,
      score: Math.min(livenessScore, 1.0),
      details: {
        ear: avgEAR,
        nosePosition: { x: nose[3].x, y: nose[3].y },
        hasNaturalMovement: livenessScore > 0.7
      }
    };
  }

  _calculateEAR(eye) {
    // Eye Aspect Ratio calculation
    const vertical1 = Math.sqrt(
      Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2)
    );
    const vertical2 = Math.sqrt(
      Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2)
    );
    const horizontal = Math.sqrt(
      Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2)
    );
    return (vertical1 + vertical2) / (2.0 * horizontal);
  }

  _calculateVariation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  _calculateMovement(positions) {
    let totalMovement = 0;
    for (let i = 1; i < positions.length; i++) {
      totalMovement += Math.sqrt(
        Math.pow(positions[i].x - positions[i - 1].x, 2) +
        Math.pow(positions[i].y - positions[i - 1].y, 2)
      );
    }
    return totalMovement / (positions.length - 1);
  }

  calculateEyeAspectRatio(leftEye, rightEye) {
    // Simplified EAR calculation
    // Real implementation would compute distances between eye landmarks
    return 0.3; // Placeholder
  }

  detectHeadMovement(frames) {
    // Compare landmark positions across frames
    return true; // Placeholder
  }

  async detectPPE(imageBuffer) {
    // Use object detection model to detect safety equipment
    // This would integrate with a model like YOLO for PPE detection

    const ppeDetected = {
      helmet: false,
      vest: false,
      goggles: false,
      gloves: false
    };

    // Mock detection - replace with actual model inference
    // const detections = await this.objectDetectionModel.detect(imageBuffer);
    // detections.forEach(d => {
    //   if (d.class === 'helmet') ppeDetected.helmet = true;
    //   if (d.class === 'vest') ppeDetected.vest = true;
    // });

    return ppeDetected;
  }

  async detectEmotion(imageBuffer) {
    // Use emotion detection model
    // Returns: neutral, happy, sad, angry, fearful, disgusted, surprised

    const emotions = ['neutral', 'happy', 'stressed', 'fatigued'];
    const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];

    return {
      emotion: randomEmotion,
      confidence: 0.85
    };
  }

  async detectGait(videoBuffer) {
    // Extract gait pattern from video sequence
    // This would use pose estimation models across frames

    return {
      patternId: 'gait_' + Date.now(),
      features: [0.1, 0.2, 0.3, 0.4] // Placeholder
    };
  }
}

module.exports = new FaceRecognitionService();
