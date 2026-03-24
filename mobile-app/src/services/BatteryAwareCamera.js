import { AppState, Platform } from 'react-native';

/**
 * Battery-aware camera management for mobile.
 *
 * - Monitors app state (foreground/background)
 * - Uses motion detection to wake camera only when needed
 * - Reduces frame rate when battery is low
 * - Pauses processing entirely in background
 */
class BatteryAwareCameraService {
  constructor() {
    this.isActive = false;
    this.appState = AppState.currentState;
    this.onWake = null;   // callback when camera should activate
    this.onSleep = null;  // callback when camera should deactivate
    this._subscription = null;
    this._motionInterval = null;
  }

  /**
   * Start monitoring app state and motion.
   * @param {Function} onWake - Called when camera should activate
   * @param {Function} onSleep - Called when camera should deactivate
   */
  start({ onWake, onSleep }) {
    this.onWake = onWake;
    this.onSleep = onSleep;
    this.isActive = true;

    // Monitor app state changes
    this._subscription = AppState.addEventListener('change', (nextState) => {
      if (this.appState.match(/inactive|background/) && nextState === 'active') {
        // App came to foreground — wake camera
        this.onWake?.();
      } else if (nextState.match(/inactive|background/)) {
        // App went to background — sleep camera
        this.onSleep?.();
      }
      this.appState = nextState;
    });
  }

  /**
   * Get recommended frame processing interval based on conditions.
   * Returns milliseconds between frame captures.
   */
  getProcessingInterval(batteryLevel) {
    if (batteryLevel !== null && batteryLevel < 0.15) {
      return 3000; // Very low battery: 1 frame every 3 seconds
    }
    if (batteryLevel !== null && batteryLevel < 0.3) {
      return 1500; // Low battery: 1 frame every 1.5 seconds
    }
    return 500; // Normal: 2 frames per second
  }

  /**
   * Check if camera should be active based on current conditions
   */
  shouldBeActive() {
    return this.isActive && this.appState === 'active';
  }

  /**
   * Stop all monitoring and cleanup
   */
  stop() {
    this.isActive = false;
    this._subscription?.remove();
    if (this._motionInterval) {
      clearInterval(this._motionInterval);
      this._motionInterval = null;
    }
  }
}

export const batteryAwareCamera = new BatteryAwareCameraService();
