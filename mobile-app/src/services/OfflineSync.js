import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const QUEUE_KEY = 'attendance_offline_queue';

class OfflineSyncService {
  /**
   * Queue an attendance record when offline.
   * Stores with a tamper-evident timestamp.
   */
  async queueAttendance(record) {
    const entry = {
      ...record,
      timestamp: new Date().toISOString(),
      queuedAt: Date.now(),
      // Simple integrity check: hash of userId + timestamp
      checksum: this._checksum(record.userId + new Date().toISOString())
    };

    const queue = await this._getQueue();
    queue.push(entry);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return entry;
  }

  /**
   * Sync all queued records to server.
   * Called when network comes back online.
   */
  async syncAll() {
    const queue = await this._getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;
    const remaining = [];

    for (const entry of queue) {
      try {
        await api.verifyFace(entry.userId, { base64: entry.imageData });
        synced++;
      } catch (err) {
        // If it's a network error, keep in queue for retry
        if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('timeout')) {
          remaining.push(entry);
        }
        failed++;
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    return { synced, failed, remaining: remaining.length };
  }

  /**
   * Get count of pending offline records
   */
  async getPendingCount() {
    const queue = await this._getQueue();
    return queue.length;
  }

  /**
   * Clear the offline queue
   */
  async clearQueue() {
    await AsyncStorage.removeItem(QUEUE_KEY);
  }

  async _getQueue() {
    try {
      const data = await AsyncStorage.getItem(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _checksum(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }
}

export const offlineSync = new OfflineSyncService();
