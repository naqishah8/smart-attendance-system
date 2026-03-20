// Lazy-load RTSP — not available in all environments
let RTSPStream = null;
try { RTSPStream = require('node-rtsp-stream'); } catch { /* optional */ }
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const FaceRecognitionService = require('./ai/FaceRecognitionService');
const ObjectDetectionService = require('./ai/ObjectDetectionService');
const LivenessService = require('./ai/LivenessDetectionService');
const AttendanceService = require('./attendance/AttendanceService');
const logger = require('../utils/logger');

const MAX_FRAME_BUFFER_SIZE = 30;
const CIRCUIT_BREAKER_THRESHOLD = 10;

class StreamProcessor extends EventEmitter {
  constructor() {
    super();
    this.streams = new Map(); // cameraId -> stream instance
    this.frameProcessors = new Map(); // cameraId -> processing interval
    this.frameBuffer = new Map(); // cameraId -> recent frames
    this.processingQueue = [];
    this.isProcessing = false;
    // Circuit breaker: track consecutive errors per camera
    this.errorCounters = new Map(); // cameraId -> consecutive error count
  }

  async connectCamera(cameraId, rtspUrl, username, password) {
    // Input validation
    if (!cameraId || !rtspUrl) {
      logger.error('connectCamera requires cameraId and rtspUrl');
      return false;
    }

    try {
      // Create authenticated URL if credentials provided
      let streamUrl = rtspUrl;
      if (username && password) {
        const url = new URL(rtspUrl);
        url.username = username;
        url.password = password;
        streamUrl = url.toString();
      }

      // Create stream
      const stream = new RTSPStream({
        name: `camera_${cameraId}`,
        streamUrl: streamUrl,
        wsPort: 0, // Don't start WebSocket server
        ffmpegOptions: {
          '-stats': '',
          '-r': '10', // 10 fps
          '-s': '640x480',
          '-q:v': '5' // Quality
        }
      });

      // Store stream
      this.streams.set(cameraId, stream);
      this.errorCounters.set(cameraId, 0);

      // Start frame processing
      this.startFrameProcessing(cameraId, stream);

      logger.info(`Camera ${cameraId} connected successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to connect camera ${cameraId}:`, error);
      return false;
    }
  }

  startFrameProcessing(cameraId, stream) {
    try {
      // Process frames every 500ms
      const interval = setInterval(async () => {
        // Circuit breaker: stop processing after too many consecutive errors
        const errorCount = this.errorCounters.get(cameraId) || 0;
        if (errorCount >= CIRCUIT_BREAKER_THRESHOLD) {
          logger.error(
            `Circuit breaker triggered for camera ${cameraId} after ${errorCount} consecutive errors. Disconnecting.`
          );
          this.disconnectCamera(cameraId);
          this.emit('circuit-breaker', { cameraId, errorCount });
          return;
        }

        try {
          // Get latest frame from stream
          const frame = await this.captureFrame(stream);
          if (!frame) return;

          // Store frame in buffer with size limit
          if (!this.frameBuffer.has(cameraId)) {
            this.frameBuffer.set(cameraId, []);
          }

          const buffer = this.frameBuffer.get(cameraId);
          buffer.push({
            frame,
            timestamp: Date.now(),
            cameraId
          });

          // Enforce frame buffer size limit per camera
          while (buffer.length > MAX_FRAME_BUFFER_SIZE) {
            buffer.shift();
          }

          // Process this frame
          await this.processFrame(cameraId, frame, buffer);

          // Reset error counter on success
          this.errorCounters.set(cameraId, 0);
        } catch (error) {
          // Increment consecutive error counter
          const currentErrors = (this.errorCounters.get(cameraId) || 0) + 1;
          this.errorCounters.set(cameraId, currentErrors);
          logger.error(
            `Error processing frame for camera ${cameraId} (consecutive: ${currentErrors}):`,
            error
          );
        }
      }, 500);

      this.frameProcessors.set(cameraId, interval);
    } catch (error) {
      logger.error(`Error in startFrameProcessing for camera ${cameraId}:`, error);
    }
  }

  async captureFrame(stream) {
    // This is a simplified version
    // In reality, you'd need to extract frames from the stream
    return null;
  }

  async processFrame(cameraId, frame, frameBuffer) {
    try {
      // Step 1: Face detection
      const faceResults = await FaceRecognitionService.recognizeFace(frame);

      if (!faceResults || faceResults.length === 0) return;

      // Step 2: For each detected face, process
      for (const result of faceResults) {
        if (!result.isKnown) continue;

        const userId = result.userId;

        // Step 3: Liveness detection
        const previousFrames = frameBuffer
          .slice(-5)
          .map(f => f.frame);

        const liveness = await LivenessService.detectLiveness(
          userId,
          frame,
          result.detection.landmarks
        );

        if (!liveness || !liveness.isAlive) {
          logger.info(`Spoof attempt detected for user ${userId}`);
          this.emit('spoof-detected', { userId, cameraId, timestamp: Date.now() });
          continue;
        }

        // Step 4: PPE detection
        const ppe = await ObjectDetectionService.detectPPE(frame);

        // Step 5: Emotion detection (periodic)
        let emotion = null;
        if (Math.random() < 0.1) { // 10% of frames
          emotion = await FaceRecognitionService.detectEmotion(frame);
        }

        // Step 6: Temperature check (if thermal camera)
        let temperature = null;
        // Get from thermal data if available

        // Step 7: Record detection — do NOT store full frameData in DB
        await AttendanceService.recordDetection({
          userId,
          cameraId,
          timestamp: Date.now(),
          livenessScore: liveness.score,
          ppeCompliance: ppe?.ppe || {},
          emotion: emotion?.emotion,
          temperature,
          confidence: result.confidence,
          frameData: null // Do not pass raw frame to avoid storing large blobs
        });

        this.emit('face-detected', {
          userId,
          cameraId,
          timestamp: Date.now(),
          ppeCompliance: ppe?.ppe || {}
        });
      }
    } catch (error) {
      logger.error('Error processing frame:', error);
      throw error; // Re-throw so caller can track in circuit breaker
    }
  }

  disconnectCamera(cameraId) {
    try {
      // Stop processing interval
      if (this.frameProcessors.has(cameraId)) {
        clearInterval(this.frameProcessors.get(cameraId));
        this.frameProcessors.delete(cameraId);
      }

      // Stop stream
      if (this.streams.has(cameraId)) {
        const stream = this.streams.get(cameraId);
        try {
          stream.stop();
        } catch (err) {
          logger.error(`Error stopping stream for camera ${cameraId}:`, err);
        }
        this.streams.delete(cameraId);
      }

      // Clear frame buffer to free memory
      this.frameBuffer.delete(cameraId);

      // Clear error counter
      this.errorCounters.delete(cameraId);

      logger.info(`Camera ${cameraId} disconnected and cleaned up`);
    } catch (error) {
      logger.error(`Error in disconnectCamera for ${cameraId}:`, error);
    }
  }

  async getLatestFrame(cameraId) {
    try {
      const buffer = this.frameBuffer.get(cameraId);
      if (!buffer || buffer.length === 0) return null;
      return buffer[buffer.length - 1];
    } catch (error) {
      logger.error(`Error in getLatestFrame for camera ${cameraId}:`, error);
      return null;
    }
  }

  getConnectedCameras() {
    const cameras = [];
    for (const [cameraId] of this.streams.entries()) {
      cameras.push({
        cameraId,
        hasProcessor: this.frameProcessors.has(cameraId),
        bufferSize: (this.frameBuffer.get(cameraId) || []).length,
        consecutiveErrors: this.errorCounters.get(cameraId) || 0
      });
    }
    return cameras;
  }
}

module.exports = new StreamProcessor();
