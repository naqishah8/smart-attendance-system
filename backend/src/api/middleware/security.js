const helmet = require('helmet');
const cors = require('cors');
const logger = require('../../utils/logger');

/**
 * Comprehensive security middleware stack.
 * Consolidates all security concerns into a single applySecurity(app) call.
 *
 * What's included:
 *  - Helmet (security headers)
 *  - CORS (configurable origins)
 *  - Body size limits
 *  - NoSQL injection prevention (built-in, no extra package)
 *  - XSS input sanitization (built-in, no extra package)
 *  - Parameter pollution prevention (built-in)
 *  - Suspicious request audit logging
 *  - Slow request detection
 */

// ─── NoSQL Injection Prevention ───────────────────────────────────
// Strips `$` and `.` keys from req.body/query/params to prevent
// MongoDB operator injection (e.g., { "$gt": "" } in password fields).
// This replaces the `express-mongo-sanitize` package (zero dependencies).

function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const clean = {};
  for (const key of Object.keys(obj)) {
    // Strip keys starting with $ or containing .
    if (key.startsWith('$') || key.includes('.')) {
      logger.warn(`NoSQL injection attempt blocked: key "${key}"`);
      continue;
    }
    clean[key] = sanitizeObject(obj[key]);
  }
  return clean;
}

const mongoSanitize = (req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
};

// ─── XSS Input Sanitization ──────────────────────────────────────
// Escapes HTML entities in string values to prevent stored XSS.
// This replaces the deprecated `xss-clean` package.

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function sanitizeStrings(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return escapeHtml(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeStrings);
  if (typeof obj === 'object') {
    const clean = {};
    for (const key of Object.keys(obj)) {
      clean[key] = sanitizeStrings(obj[key]);
    }
    return clean;
  }
  return obj;
}

const xssSanitize = (req, res, next) => {
  // Only sanitize body — query params and URL params are typically
  // used for lookups, not stored. Body goes into the database.
  if (req.body) req.body = sanitizeStrings(req.body);
  next();
};

// ─── Parameter Pollution Prevention ───────────────────────────────
// If a query param appears multiple times (?sort=name&sort=email),
// Express parses it as an array which can break .trim() or comparisons.
// This picks the last value (like hpp package does).

const preventParamPollution = (req, res, next) => {
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (Array.isArray(req.query[key])) {
        req.query[key] = req.query[key][req.query[key].length - 1];
      }
    }
  }
  next();
};

// ─── Suspicious Request Logging ───────────────────────────────────
// Logs 4xx/5xx responses and slow requests (>2s) for security monitoring.

const suspiciousRequestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Log 4xx client errors (possible attacks)
    if (res.statusCode >= 400 && res.statusCode < 500) {
      logger.audit(req.user?.userId || 'anonymous', 'CLIENT_ERROR', {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    // Log 5xx server errors
    if (res.statusCode >= 500) {
      logger.audit(req.user?.userId || 'system', 'SERVER_ERROR', {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration,
        ip: req.ip
      });
    }

    // Log slow requests (>2 seconds)
    if (duration > 2000) {
      logger.audit(req.user?.userId || 'anonymous', 'SLOW_REQUEST', {
        method: req.method,
        path: req.originalUrl,
        duration,
        ip: req.ip
      });
    }
  });

  next();
};

// ─── Apply All Security ───────────────────────────────────────────

const applySecurity = (app, options = {}) => {
  const allowedOrigins = options.allowedOrigins || (
    process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3001', 'http://localhost:8080']
  );

  // 1. Security headers (X-Frame-Options, CSP, HSTS, etc.)
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
  }));

  // 2. CORS
  app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 600
  }));

  // 3. Body parsing with size limits
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '10mb' }));

  // 4. NoSQL injection prevention
  app.use(mongoSanitize);

  // 5. XSS input sanitization
  app.use(xssSanitize);

  // 6. Parameter pollution prevention
  app.use(preventParamPollution);

  // 7. Suspicious request audit logging
  app.use(suspiciousRequestLogger);

  logger.info('Security middleware applied');
};

module.exports = {
  applySecurity,
  // Export individual middleware for selective use in tests
  mongoSanitize,
  xssSanitize,
  preventParamPollution,
  suspiciousRequestLogger
};
