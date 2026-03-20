/**
 * Health Check & Metrics Monitoring
 *
 * Provides:
 *  - health.checkHealth()    — full service health with DB, cache, disk status
 *  - health.getMetrics()     — request counts, error rates, memory, CPU, AI/DB perf
 *  - health.middleware()      — Express middleware that auto-records requests/errors
 *  - health.registerRoutes() — Mounts /api/health and /api/metrics on an Express app
 *
 * Zero external dependencies — uses our existing CacheService (not raw redis).
 */
const os = require('os');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

class HealthMonitor {
  constructor() {
    this.startTime = Date.now();

    // Rolling metrics — capped at 1000 entries to prevent memory growth
    this._requestCount = 0;
    this._errorCount = 0;
    this._aiTimes = [];     // last N AI processing durations (ms)
    this._dbTimes = [];     // last N DB query durations (ms)
    this._maxSamples = 1000;
  }

  // ─── Health Check ───────────────────────────────────────────────

  async checkHealth() {
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      services: {}
    };

    // 1. Database
    checks.services.database = this._checkDatabase();

    // 2. Cache (uses our CacheService — works with Redis or in-memory)
    checks.services.cache = await this._checkCache();

    // 3. Memory pressure
    checks.services.memory = this._checkMemory();

    // 4. Event loop lag (detect if Node is overloaded)
    checks.services.eventLoop = await this._checkEventLoop();

    // Overall: degraded if any service is unhealthy
    const allStatuses = Object.values(checks.services).map(s => s.status);
    if (allStatuses.includes('unhealthy')) {
      checks.status = 'unhealthy';
    } else if (allStatuses.includes('warning')) {
      checks.status = 'degraded';
    }

    return checks;
  }

  _checkDatabase() {
    try {
      const state = mongoose.connection.readyState;
      const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
      return {
        status: state === 1 ? 'healthy' : 'unhealthy',
        state: stateNames[state] || 'unknown'
      };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  async _checkCache() {
    try {
      const cache = require('../services/cache/CacheService');
      const stats = cache.getStats();

      // Quick read/write test
      const testKey = '_health_check_' + Date.now();
      await cache.set(testKey, 'ok', 5);
      const result = await cache.get(testKey);
      await cache.del(testKey);

      return {
        status: result === 'ok' ? 'healthy' : 'warning',
        backend: stats.backend,
        entries: stats.memoryEntries
      };
    } catch (error) {
      return { status: 'warning', error: error.message };
    }
  }

  _checkMemory() {
    const mem = process.memoryUsage();
    const heapUsedMB = mem.heapUsed / 1024 / 1024;
    const heapTotalMB = mem.heapTotal / 1024 / 1024;
    const heapPercent = (heapUsedMB / heapTotalMB) * 100;

    let status = 'healthy';
    if (heapPercent > 90) status = 'unhealthy';
    else if (heapPercent > 75) status = 'warning';

    return {
      status,
      heapUsedMB: heapUsedMB.toFixed(1),
      heapTotalMB: heapTotalMB.toFixed(1),
      heapPercent: heapPercent.toFixed(1),
      rssMB: (mem.rss / 1024 / 1024).toFixed(1)
    };
  }

  async _checkEventLoop() {
    // Measure event loop lag — healthy if < 100ms
    return new Promise(resolve => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        let status = 'healthy';
        if (lag > 500) status = 'unhealthy';
        else if (lag > 100) status = 'warning';

        resolve({ status, lagMs: lag });
      });
    });
  }

  // ─── Metrics ────────────────────────────────────────────────────

  getMetrics() {
    const memory = process.memoryUsage();
    const cpuLoad = os.loadavg();

    return {
      requests: {
        total: this._requestCount,
        errors: this._errorCount,
        errorRate: this._requestCount > 0
          ? ((this._errorCount / this._requestCount) * 100).toFixed(2) + '%'
          : '0%'
      },
      performance: {
        ai: this._summarizeTimes(this._aiTimes),
        db: this._summarizeTimes(this._dbTimes)
      },
      system: {
        memory: {
          rssMB: (memory.rss / 1024 / 1024).toFixed(1),
          heapUsedMB: (memory.heapUsed / 1024 / 1024).toFixed(1),
          heapTotalMB: (memory.heapTotal / 1024 / 1024).toFixed(1),
          externalMB: (memory.external / 1024 / 1024).toFixed(1)
        },
        cpu: {
          load1m: cpuLoad[0].toFixed(2),
          load5m: cpuLoad[1].toFixed(2),
          load15m: cpuLoad[2].toFixed(2),
          cores: os.cpus().length
        },
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
        platform: os.platform()
      }
    };
  }

  _summarizeTimes(times) {
    if (times.length === 0) {
      return { avgMs: 0, p95Ms: 0, maxMs: 0, samples: 0 };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      avgMs: +(sum / sorted.length).toFixed(2),
      p95Ms: +sorted[p95Index].toFixed(2),
      maxMs: +sorted[sorted.length - 1].toFixed(2),
      samples: sorted.length
    };
  }

  // ─── Recording Methods ──────────────────────────────────────────

  recordRequest() {
    this._requestCount++;
  }

  recordError() {
    this._errorCount++;
  }

  recordAITime(ms) {
    this._aiTimes.push(ms);
    if (this._aiTimes.length > this._maxSamples) {
      this._aiTimes = this._aiTimes.slice(-this._maxSamples);
    }
  }

  recordDbTime(ms) {
    this._dbTimes.push(ms);
    if (this._dbTimes.length > this._maxSamples) {
      this._dbTimes = this._dbTimes.slice(-this._maxSamples);
    }
  }

  // ─── Express Middleware ─────────────────────────────────────────

  /**
   * Middleware that auto-records request count and error count.
   * Mount with: app.use(health.middleware());
   */
  middleware() {
    return (req, res, next) => {
      this.recordRequest();
      res.on('finish', () => {
        if (res.statusCode >= 500) {
          this.recordError();
        }
      });
      next();
    };
  }

  // ─── Route Registration ─────────────────────────────────────────

  /**
   * Registers /api/health and /api/metrics routes.
   * Call with: health.registerRoutes(app);
   */
  registerRoutes(app) {
    const asyncHandler = require('../utils/asyncHandler');

    // Health check — no auth required
    app.get('/api/health', asyncHandler(async (req, res) => {
      const result = await this.checkHealth();
      const status = result.status === 'healthy' ? 200 : 503;
      res.status(status).json(result);
    }));

    // Metrics — no auth required (could restrict to admin in production)
    app.get('/api/metrics', asyncHandler(async (req, res) => {
      res.json(this.getMetrics());
    }));
  }
}

module.exports = new HealthMonitor();
