const RTSPStream = require('node-rtsp-stream');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const FaceRecognitionService = require('./ai/FaceRecognitionService');
const ObjectDetectionService = require('./ai/ObjectDetectionService');
const LivenessService = require('./ai/LivenessDetectionService');
const AttendanceService = require('./attendance/AttendanceService');

class StreamProcessor extends EventEmitter {
  constructor() {
    super();
    this.streams = new Map(); // cameraId -> stream instance
    this.frameProcessors = new Map(); // cameraId -> processing interval
    this.frameBuffer = new Map(); // cameraId -> recent frames
    this.processingQueue = [];
    this.isProcessing = false;
  }

  async connectCamera(cameraId, rtspUrl, username, password) {
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

      // Start frame processing
      this.startFrameProcessing(cameraId, stream);

      console.log(`Camera ${cameraId} connected successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to connect camera ${cameraId}:`, error);
      return false;
    }
  }

  startFrameProcessing(cameraId, stream) {
    // Process frames every 500ms
    const interval = setInterval(async () => {
      try {
        // Get latest frame from stream
        const frame = await this.captureFrame(stream);
        if (!frame) return;

        // Store frame in buffer
        if (!this.frameBuffer.has(cameraId)) {
          this.frameBuffer.set(cameraId, []);
        }

        const buffer = this.frameBuffer.get(cameraId);
        buffer.push({
          frame,
          timestamp: Date.now(),
          cameraId
        });

        // Keep only last 30 frames
        if (buffer.length > 30) buffer.shift();

        // Process this frame
        await this.processFrame(cameraId, frame, buffer);
      } catch (error) {
        console.error(`Error processing frame for camera ${cameraId}:`, error);
      }
    }, 500);

    this.frameProcessors.set(cameraId, interval);
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

        if (!liveness.isAlive) {
          console.log(`Spoof attempt detected for user ${userId}`);
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

        // Step 7: Record detection
        await AttendanceService.recordDetection({
          userId,
          cameraId,
          timestamp: Date.now(),
          livenessScore: liveness.score,
          ppeCompliance: ppe.ppe,
          emotion: emotion?.emotion,
          temperature,
          confidence: result.confidence,
          frameData: frame // Store for evidence
        });

        this.emit('face-detected', {
          userId,
          cameraId,
          timestamp: Date.now(),
          ppeCompliance: ppe.ppe
        });
      }
    } catch (error) {
      console.error('Error processing frame:', error);
    }
  }

  disconnectCamera(cameraId) {
    // Stop processing interval
    if (this.frameProcessors.has(cameraId)) {
      clearInterval(this.frameProcessors.get(cameraId));
      this.frameProcessors.delete(cameraId);
    }

    // Stop stream
    if (this.streams.has(cameraId)) {
      const stream = this.streams.get(cameraId);
      stream.stop();
      this.streams.delete(cameraId);
    }

    // Clear buffer
    this.frameBuffer.delete(cameraId);
  }

  async getLatestFrame(cameraId) {
    const buffer = this.frameBuffer.get(cameraId);
    if (!buffer || buffer.length === 0) return null;
    return buffer[buffer.length - 1];
  }
}

module.exports = new StreamProcessor();
