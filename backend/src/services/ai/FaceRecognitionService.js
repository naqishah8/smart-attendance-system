const path = require('path');
const EventEmitter = require('events');
const User = require('../../models/User');
const logger = require('../../utils/logger');

// Lazy-load heavy AI dependencies — only imported when actually needed
let tf = null;
let faceapi = null;

function loadAIDeps() {
  if (!tf) {
    try {
      tf = require('@tensorflow/tfjs-node');
      faceapi = require('face-api.js');
    } catch (err) {
      logger.warn('AI dependencies not available: ' + err.message);
    }
  }
}

class FaceRecognitionService extends EventEmitter {
  constructor() {
    super();
    this.modelsLoaded = false;
    this.faceMatcher = null;
    this.faceMatcherVersion = null;
    this.knownFaces = new Map();

    // Queue & batch config
    this.processingQueue = [];
    this.isProcessing = false;
    this.maxQueueSize = 100;
    this.batchSize = 4;

    // In-memory face cache with TTL
    this._faceCacheData = null;
    this._faceCacheExpiry = 0;
    this._faceCacheTTL = 5 * 60 * 1000; // 5 minutes

    this.modelVersion = '1.0.0';
  }

  // ─── Model Loading ──────────────────────────────────────────────

  async loadModels() {
    if (this.modelsLoaded) return;

    loadAIDeps();
    if (!tf || !faceapi) {
      logger.warn('Cannot load models: AI dependencies not installed');
      return;
    }

    try {
      const modelPath = process.env.MODEL_PATH || path.join(__dirname, '../../../ai-models/face_recognition');

      // Load all three models in parallel
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath)
      ]);

      // Warm up with dummy tensor to prime GPU/CPU pipelines
      const dummyTensor = tf.zeros([1, 224, 224, 3]);
      try {
        await faceapi.detectSingleFace(dummyTensor);
      } catch {
        // Warmup may fail on dummy data — that's expected
      } finally {
        tf.dispose(dummyTensor);
      }

      this.modelsLoaded = true;
      logger.info('Face recognition models loaded and warmed up');
      this.emit('models-loaded');
    } catch (error) {
      logger.error('Failed to load face recognition models:', error);
      throw new Error('Face recognition models could not be loaded');
    }
  }

  // ─── Face Registration ──────────────────────────────────────────

  async registerUserFace(userId, imageBuffer) {
    if (!userId || !imageBuffer) {
      throw new Error('userId and imageBuffer are required');
    }

    if (!this.modelsLoaded) await this.loadModels();
    if (!this.modelsLoaded) throw new Error('Models not loaded');

    let img;
    try {
      img = tf.node.decodeImage(imageBuffer, 3);

      const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('No face detected in image');
      }

      const descriptor = Array.from(detection.descriptor);

      await User.updateOne(
        { _id: userId },
        { $push: { faceEmbeddings: { vector: descriptor, captureDate: new Date() } } }
      );

      // Update in-memory cache
      if (!this.knownFaces.has(userId)) {
        this.knownFaces.set(userId, []);
      }
      this.knownFaces.get(userId).push(descriptor);

      // Invalidate caches so next recognition rebuilds
      this.faceMatcher = null;
      this.faceMatcherVersion = null;
      this._faceCacheData = null;
      this._faceCacheExpiry = 0;

      return { success: true, confidence: detection.detection.score };
    } catch (error) {
      logger.error('Error in registerUserFace:', error);
      throw error;
    } finally {
      if (img) tf.dispose(img);
    }
  }

  // ─── Single-Frame Recognition ───────────────────────────────────

  async recognizeFace(imageBuffer, options = {}) {
    const {
      threshold = 0.6,
      maxResults = 10,
      returnLandmarks = false
    } = typeof options === 'number' ? { threshold: options } : options;

    if (!imageBuffer) return [];
    if (!this.modelsLoaded) await this.loadModels();
    if (!this.modelsLoaded) {
      logger.warn('Models not loaded, returning empty results');
      return [];
    }

    let img;
    try {
      img = tf.node.decodeImage(imageBuffer, 3);

      const detections = await faceapi
        .detectAllFaces(img)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections || detections.length === 0) {
        return [];
      }

      // Limit results to maxResults
      const limitedDetections = detections.slice(0, maxResults);

      // Build or use cached faceMatcher
      const matcher = await this._getFaceMatcher(threshold);
      if (!matcher) return [];

      const results = limitedDetections.map(detection => {
        const bestMatch = matcher.findBestMatch(detection.descriptor);

        const result = {
          userId: bestMatch.label !== 'unknown' ? bestMatch.label : null,
          confidence: 1 - bestMatch.distance, // Convert distance to confidence (0-1)
          isKnown: bestMatch.label !== 'unknown',
          detection: {
            box: {
              x: detection.detection.box.x,
              y: detection.detection.box.y,
              width: detection.detection.box.width,
              height: detection.detection.box.height
            }
          }
        };

        if (returnLandmarks) {
          result.detection.landmarks = detection.landmarks.positions;
        }

        return result;
      });

      return results;
    } catch (error) {
      logger.error('Error in recognizeFace:', error);
      return [];
    } finally {
      if (img) tf.dispose(img);
    }
  }

  // ─── Batch Recognition ──────────────────────────────────────────

  async batchRecognize(frames, options = {}) {
    if (!frames || frames.length === 0) return [];

    const results = [];
    for (let i = 0; i < frames.length; i += this.batchSize) {
      const batch = frames.slice(i, i + this.batchSize);
      const batchResults = await Promise.all(
        batch.map(frame => this.recognizeFace(frame, options))
      );
      results.push(...batchResults);
    }

    return results;
  }

  // ─── Queue Processing ───────────────────────────────────────────

  enqueueFrame(frame, callback) {
    if (this.processingQueue.length >= this.maxQueueSize) {
      // Drop oldest frame to prevent memory buildup
      this.processingQueue.shift();
      logger.warn('Processing queue full, dropping oldest frame');
    }

    this.processingQueue.push({ frame, callback });
    this._processQueue();
  }

  async _processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) return;

    this.isProcessing = true;
    try {
      while (this.processingQueue.length > 0) {
        const batch = this.processingQueue.splice(0, this.batchSize);
        const frames = batch.map(item => item.frame);

        const results = await this.batchRecognize(frames);

        batch.forEach((item, index) => {
          if (item.callback) {
            item.callback(null, results[index]);
          }
        });
      }
    } catch (error) {
      logger.error('Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // ─── Face Matcher Cache ─────────────────────────────────────────

  async _getFaceMatcher(threshold) {
    try {
      const knownUsers = await this._getCachedKnownFaces();
      if (!knownUsers || knownUsers.length === 0) return null;

      // Check if we can reuse the existing matcher
      const currentVersion = knownUsers.reduce(
        (max, u) => Math.max(max, new Date(u.updatedAt || 0).getTime()), 0
      );

      if (this.faceMatcher && this.faceMatcherVersion === currentVersion) {
        return this.faceMatcher;
      }

      // Rebuild matcher
      const labeledDescriptors = knownUsers.flatMap(user =>
        (user.faceEmbeddings || []).map(embedding =>
          new faceapi.LabeledFaceDescriptors(
            user._id.toString(),
            [new Float32Array(embedding.vector)]
          )
        )
      );

      if (labeledDescriptors.length === 0) return null;

      this.faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
      this.faceMatcherVersion = currentVersion;

      logger.info(`Face matcher rebuilt with ${labeledDescriptors.length} descriptors`);
      return this.faceMatcher;
    } catch (error) {
      logger.error('Error building face matcher:', error);
      return null;
    }
  }

  async _getCachedKnownFaces() {
    const now = Date.now();

    // Return cached data if still valid
    if (this._faceCacheData && now < this._faceCacheExpiry) {
      return this._faceCacheData;
    }

    // Load from DB with minimal projection
    const users = await User.find(
      { isActive: true, 'faceEmbeddings.0': { $exists: true } },
      { _id: 1, faceEmbeddings: 1, updatedAt: 1 }
    ).lean();

    // Cache in memory with TTL (no external Redis dependency)
    this._faceCacheData = users;
    this._faceCacheExpiry = now + this._faceCacheTTL;

    return users;
  }

  // ─── Liveness Verification ──────────────────────────────────────

  async verifyLiveness(imageBuffer, previousFrames = []) {
    if (!imageBuffer) {
      return { isLive: false, score: 0, reason: 'No image provided' };
    }

    if (!this.modelsLoaded) await this.loadModels();
    if (!this.modelsLoaded) {
      return { isLive: false, score: 0, reason: 'Models not loaded' };
    }

    let img;
    try {
      img = tf.node.decodeImage(imageBuffer, 3);
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks();

      if (!detection) {
        return { isLive: false, score: 0, reason: 'No face detected' };
      }

      const landmarks = detection.landmarks;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const leftEAR = this._calculateEAR(leftEye);
      const rightEAR = this._calculateEAR(rightEye);
      const avgEAR = (leftEAR + rightEAR) / 2;

      const nose = landmarks.getNose();

      let livenessScore = 0.5;

      if (previousFrames.length >= 3) {
        const earVariation = this._calculateVariation(previousFrames.map(f => f.ear));
        if (earVariation > 0.05) livenessScore += 0.2;
      }

      if (previousFrames.length >= 5) {
        const nosePositions = previousFrames.map(f => f.nosePosition);
        const movement = this._calculateMovement(nosePositions);
        if (movement > 2 && movement < 50) livenessScore += 0.2;
      }

      livenessScore += 0.1; // Texture analysis placeholder

      return {
        isLive: livenessScore > 0.6,
        score: Math.min(livenessScore, 1.0),
        details: {
          ear: avgEAR,
          nosePosition: { x: nose[3].x, y: nose[3].y },
          hasNaturalMovement: livenessScore > 0.7
        }
      };
    } catch (error) {
      logger.error('Error in verifyLiveness:', error);
      return { isLive: false, score: 0, reason: 'Liveness check failed' };
    } finally {
      if (img) tf.dispose(img);
    }
  }

  // ─── PPE / Emotion / Gait (Delegated to ObjectDetectionService in production) ──

  async detectPPE(imageBuffer) {
    if (!imageBuffer) return { helmet: false, vest: false, goggles: false, gloves: false };
    return { helmet: false, vest: false, goggles: false, gloves: false };
  }

  async detectEmotion(imageBuffer) {
    if (!imageBuffer) return { emotion: 'neutral', confidence: 0 };
    const emotions = ['neutral', 'happy', 'stressed', 'fatigued'];
    return {
      emotion: emotions[Math.floor(Math.random() * emotions.length)],
      confidence: 0.85
    };
  }

  async detectGait(videoBuffer) {
    if (!videoBuffer) return { patternId: null, features: [] };
    return { patternId: 'gait_' + Date.now(), features: [0.1, 0.2, 0.3, 0.4] };
  }

  // ─── Math Helpers ───────────────────────────────────────────────

  _calculateEAR(eye) {
    const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
    const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
    const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
    return h > 0 ? (v1 + v2) / (2.0 * h) : 0;
  }

  _calculateVariation(values) {
    if (!values || values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  _calculateMovement(positions) {
    if (!positions || positions.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < positions.length; i++) {
      total += Math.sqrt(
        Math.pow(positions[i].x - positions[i - 1].x, 2) +
        Math.pow(positions[i].y - positions[i - 1].y, 2)
      );
    }
    return total / (positions.length - 1);
  }

  // ─── Cache Management ───────────────────────────────────────────

  clearCaches() {
    this.knownFaces.clear();
    this.faceMatcher = null;
    this.faceMatcherVersion = null;
    this._faceCacheData = null;
    this._faceCacheExpiry = 0;
    this.processingQueue = [];
    logger.info('Face recognition caches cleared');
  }

  getStats() {
    return {
      modelsLoaded: this.modelsLoaded,
      modelVersion: this.modelVersion,
      knownFacesCount: this.knownFaces.size,
      matcherBuilt: !!this.faceMatcher,
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing,
      tensorCount: tf.memory().numTensors
    };
  }
}

module.exports = new FaceRecognitionService();
