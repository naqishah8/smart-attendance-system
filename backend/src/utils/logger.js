const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// ─── Log Levels ───────────────────────────────────────────────────
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(colors);

// ─── Formats ──────────────────────────────────────────────────────

const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const entry = {
      timestamp,
      level,
      message,
      service: 'attendance-system',
      env: process.env.NODE_ENV || 'development'
    };
    if (stack) entry.stack = stack;
    if (Object.keys(meta).length > 0) entry.meta = meta;
    return JSON.stringify(entry);
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}${stackStr}`;
  })
);

// ─── Transports ───────────────────────────────────────────────────

const logsDir = path.join(process.cwd(), 'logs');
const transports = [];

// File transports only in non-test environments
if (process.env.NODE_ENV !== 'test') {
  // Error log — errors only, 14 day retention
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: structuredFormat
    })
  );

  // Combined log — all levels, 30 day retention
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: structuredFormat
    })
  );
}

// Console transport — always in dev/test, only errors in production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.Console({
      level: 'error',
      format: structuredFormat
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.NODE_ENV === 'test'
        ? winston.format.combine(winston.format.simple()) // Minimal in tests
        : consoleFormat
    })
  );
}

// ─── Create Logger ────────────────────────────────────────────────

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  transports,
  // Don't crash the app on logging errors
  exitOnError: false
});

// ─── Performance Tracking ─────────────────────────────────────────

/**
 * Track the duration of an operation.
 * Usage:
 *   const perf = logger.trackPerformance('faceRecognition');
 *   // ... do work ...
 *   const ms = perf.end();
 *   logger.info(`Face recognition took ${ms}ms`);
 */
logger.trackPerformance = (operation) => {
  const start = process.hrtime.bigint();
  return {
    end: () => {
      const elapsed = Number(process.hrtime.bigint() - start) / 1e6; // nanoseconds → ms
      logger.debug(`[PERF] ${operation}: ${elapsed.toFixed(2)}ms`);
      return elapsed;
    }
  };
};

// ─── Audit Logging ────────────────────────────────────────────────

/**
 * Log sensitive/security-relevant operations for compliance.
 * Written at 'info' level with type=audit for easy filtering.
 *
 * Usage:
 *   logger.audit('user123', 'DATA_EXPORT', { ip: req.ip });
 */
logger.audit = (userId, action, details = {}) => {
  logger.info(`AUDIT: ${action}`, {
    type: 'audit',
    userId,
    action,
    ip: details.ip,
    userAgent: details.userAgent,
    ...details
  });
};

// ─── HTTP Request Logger Middleware ────────────────────────────────

/**
 * Express middleware for HTTP request logging.
 * Usage: app.use(logger.httpMiddleware);
 */
logger.httpMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'http';
    logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip
    });
  });
  next();
};

// ─── Export ───────────────────────────────────────────────────────
// The logger IS the default export, with trackPerformance/audit/httpMiddleware
// attached as properties. This maintains backward compatibility:
//   const logger = require('./utils/logger');
//   logger.info('works');
//   logger.audit('userId', 'ACTION');
//   logger.trackPerformance('op');

module.exports = logger;
