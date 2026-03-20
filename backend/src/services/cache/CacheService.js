const logger = require('../../utils/logger');

/**
 * Caching service with in-memory store (zero cost, no external dependency).
 * Optionally connects to Redis when REDIS_URI is set and the `redis` package is installed.
 *
 * Usage:
 *   const cache = require('./CacheService');
 *   await cache.connect();           // Call once on startup
 *   await cache.set('key', data);    // Store with default TTL (5 min)
 *   const val = await cache.get('key');
 *   await cache.del('key');
 *   await cache.invalidatePattern('attendance:*');
 */
class CacheService {
  constructor() {
    this.redisClient = null;
    this.isRedisConnected = false;
    this.defaultTTL = 300; // 5 minutes in seconds

    // In-memory store (always available as primary or fallback)
    this._mem = new Map();         // key -> { value, expiry }
    this._cleanupInterval = null;
  }

  // ─── Connection ─────────────────────────────────────────────────

  async connect() {
    // Start memory cleanup interval
    this._startCleanup();

    // Attempt Redis if configured and package is installed
    const redisUri = process.env.REDIS_URI;
    if (!redisUri) {
      logger.info('CacheService: No REDIS_URI set, using in-memory cache');
      return;
    }

    try {
      // Dynamic import — only fails if redis package isn't installed
      const redis = require('redis');

      this.redisClient = redis.createClient({
        url: redisUri,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.warn('CacheService: Redis max retries exceeded, falling back to memory');
              return false; // Stop reconnecting
            }
            return Math.min(retries * 200, 3000);
          }
        }
      });

      this.redisClient.on('connect', () => {
        this.isRedisConnected = true;
        logger.info('CacheService: Redis connected');
      });

      this.redisClient.on('error', (err) => {
        if (this.isRedisConnected) {
          logger.error('CacheService: Redis error:', err.message);
        }
        this.isRedisConnected = false;
      });

      this.redisClient.on('end', () => {
        this.isRedisConnected = false;
        logger.warn('CacheService: Redis disconnected, using memory fallback');
      });

      await this.redisClient.connect();
    } catch (error) {
      // redis package not installed or connection failed — that's fine
      logger.info(`CacheService: Redis unavailable (${error.message}), using in-memory cache`);
      this.redisClient = null;
      this.isRedisConnected = false;
    }
  }

  // ─── Core Operations ────────────────────────────────────────────

  async get(key) {
    // Try Redis first
    if (this.isRedisConnected) {
      try {
        const value = await this.redisClient.get(key);
        if (value !== null) {
          return JSON.parse(value);
        }
        return null;
      } catch (error) {
        logger.error(`CacheService: Redis GET error for ${key}:`, error.message);
        // Fall through to memory
      }
    }

    // Memory fallback
    const entry = this._mem.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this._mem.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key, value, ttl = this.defaultTTL) {
    // Write to Redis if available
    if (this.isRedisConnected) {
      try {
        await this.redisClient.setEx(key, ttl, JSON.stringify(value));
      } catch (error) {
        logger.error(`CacheService: Redis SET error for ${key}:`, error.message);
      }
    }

    // Always write to memory (so reads work even if Redis dies mid-request)
    this._mem.set(key, {
      value,
      expiry: Date.now() + (ttl * 1000)
    });

    return true;
  }

  async del(key) {
    if (this.isRedisConnected) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        logger.error(`CacheService: Redis DEL error for ${key}:`, error.message);
      }
    }

    this._mem.delete(key);
  }

  async invalidatePattern(pattern) {
    // Redis: use SCAN (not KEYS) to avoid blocking
    if (this.isRedisConnected) {
      try {
        let cursor = 0;
        do {
          const result = await this.redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
          cursor = result.cursor;
          if (result.keys.length > 0) {
            await this.redisClient.del(result.keys);
          }
        } while (cursor !== 0);
      } catch (error) {
        logger.error(`CacheService: Redis pattern invalidation error:`, error.message);
      }
    }

    // Memory: match pattern (simple glob with * support)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this._mem.keys()) {
      if (regex.test(key)) {
        this._mem.delete(key);
      }
    }
  }

  // ─── Domain-Specific Helpers ────────────────────────────────────

  async cacheAttendanceSummary(userId, month, year, data) {
    await this.set(`attendance:${userId}:${month}:${year}`, data, 3600); // 1 hour
  }

  async getAttendanceSummary(userId, month, year) {
    return this.get(`attendance:${userId}:${month}:${year}`);
  }

  async cacheDashboardStats(data) {
    await this.set('dashboard:stats', data, 60); // 1 minute
  }

  async getDashboardStats() {
    return this.get('dashboard:stats');
  }

  async cacheUserProfile(userId, data) {
    await this.set(`user:${userId}`, data, 600); // 10 minutes
  }

  async getUserProfile(userId) {
    return this.get(`user:${userId}`);
  }

  async invalidateUserCaches(userId) {
    await this.invalidatePattern(`attendance:${userId}:*`);
    await this.del(`user:${userId}`);
  }

  async invalidateDashboard() {
    await this.del('dashboard:stats');
  }

  // ─── Cleanup & Stats ───────────────────────────────────────────

  _startCleanup() {
    if (this._cleanupInterval) return;

    // Purge expired memory entries every 60 seconds
    this._cleanupInterval = setInterval(() => {
      const now = Date.now();
      let purged = 0;
      for (const [key, entry] of this._mem) {
        if (now > entry.expiry) {
          this._mem.delete(key);
          purged++;
        }
      }
      if (purged > 0) {
        logger.debug(`CacheService: Purged ${purged} expired memory entries`);
      }
    }, 60 * 1000);

    // Don't prevent process exit
    if (this._cleanupInterval.unref) {
      this._cleanupInterval.unref();
    }
  }

  getStats() {
    return {
      backend: this.isRedisConnected ? 'redis' : 'memory',
      memoryEntries: this._mem.size,
      redisConnected: this.isRedisConnected
    };
  }

  async disconnect() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        // Ignore disconnect errors
      }
      this.redisClient = null;
      this.isRedisConnected = false;
    }

    this._mem.clear();
  }
}

module.exports = new CacheService();
