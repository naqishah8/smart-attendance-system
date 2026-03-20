class LivenessDetectionService {
  constructor() {
    this.frameBuffer = new Map(); // userId -> array of recent frames
    this.maxFramesPerUser = 10;
  }

  async detectLiveness(userId, currentFrame, faceLandmarks) {
    // Get recent frames for this user
    if (!this.frameBuffer.has(userId)) {
      this.frameBuffer.set(userId, []);
    }

    const frames = this.frameBuffer.get(userId);
    frames.push({ frame: currentFrame, landmarks: faceLandmarks, timestamp: Date.now() });

    // Keep only recent frames
    if (frames.length > this.maxFramesPerUser) {
      frames.shift();
    }

    // Need at least 3 frames for analysis
    if (frames.length < 3) {
      return { isAlive: false, score: 0, reason: 'insufficient_frames' };
    }

    // Test 1: Check for micro-expressions (blink, mouth movement)
    const hasMicroExpressions = await this.detectMicroExpressions(frames);

    // Test 2: Check for natural head movement
    const hasHeadMovement = this.detectHeadMovement(frames);

    // Test 3: Check for texture analysis (print vs real skin)
    const textureScore = await this.analyzeTexture(currentFrame);

    // Test 4: Check for depth (if using stereo or multiple cameras)
    const depthScore = await this.estimateDepth(frames);

    // Combine scores
    const livenessScore = (
      (hasMicroExpressions ? 0.4 : 0) +
      (hasHeadMovement ? 0.3 : 0) +
      (textureScore * 0.2) +
      (depthScore * 0.1)
    );

    const isAlive = livenessScore > 0.7;

    return {
      isAlive,
      score: livenessScore,
      details: {
        microExpressions: hasMicroExpressions,
        headMovement: hasHeadMovement,
        textureScore,
        depthScore
      }
    };
  }

  async detectMicroExpressions(frames) {
    // Check for eye blinks
    let blinkDetected = false;
    let mouthMovementDetected = false;

    // Track eye aspect ratio across frames
    const eyeAspectRatios = frames.map(f =>
      this.calculateEyeAspectRatio(f.landmarks)
    );

    // Look for sudden drop (blink)
    for (let i = 1; i < eyeAspectRatios.length; i++) {
      if (eyeAspectRatios[i - 1] > 0.25 && eyeAspectRatios[i] < 0.15) {
        blinkDetected = true;
        break;
      }
    }

    return blinkDetected || mouthMovementDetected;
  }

  detectHeadMovement(frames) {
    if (frames.length < 2) return false;

    // Track nose position across frames
    const nosePositions = frames.map(f => this.getNosePosition(f.landmarks));

    // Calculate movement
    let totalMovement = 0;
    for (let i = 1; i < nosePositions.length; i++) {
      const dx = nosePositions[i].x - nosePositions[i - 1].x;
      const dy = nosePositions[i].y - nosePositions[i - 1].y;
      totalMovement += Math.sqrt(dx * dx + dy * dy);
    }

    return totalMovement > 10; // Threshold for natural movement
  }

  async analyzeTexture(imageBuffer) {
    // Analyze for print artifacts, screen reflections
    // This would use frequency domain analysis
    return 0.9; // Placeholder
  }

  async estimateDepth(frames) {
    // If using multiple cameras or structured light
    return 0.8; // Placeholder
  }

  calculateEyeAspectRatio(landmarks) {
    // Simplified calculation
    return 0.3;
  }

  getNosePosition(landmarks) {
    // Extract nose tip position
    return { x: 0, y: 0 };
  }
}

module.exports = new LivenessDetectionService();
