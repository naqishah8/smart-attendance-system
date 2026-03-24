const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./api/middleware/errorHandler');
const { applySecurity } = require('./api/middleware/security');
const authMiddleware = require('./api/middleware/auth');
const rateLimiter = require('./api/middleware/rateLimiter');

const app = express();
const server = http.createServer(app);

// Allowed origins from env (comma-separated) or default for dev
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3001', 'http://localhost:8080'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// ─── Security & Middleware ─────────────────────────────────────────
// Applies: helmet, CORS, body parsing, NoSQL sanitization, XSS
// prevention, parameter pollution prevention, audit logging
applySecurity(app, { allowedOrigins });

// Rate limiting (applied after security so sanitized requests are rate-limited)
app.use('/api/auth/login', rateLimiter.loginLimiter);
app.use('/api/', rateLimiter.apiLimiter);

// HTTP request logging
app.use(logger.httpMiddleware);

// ─── Monitoring ───────────────────────────────────────────────────
const health = require('./monitoring/health');
app.use(health.middleware());       // Auto-records request/error counts
health.registerRoutes(app);         // Mounts /api/health and /api/metrics

// ─── Routes ───────────────────────────────────────────────────────
// Public routes (no auth)
app.use('/api/auth', require('./api/routes/auth'));

// Protected routes (require auth)
app.use('/api/employees', authMiddleware, require('./api/routes/employees'));
app.use('/api/attendance', authMiddleware, require('./api/routes/attendance'));
app.use('/api/cameras', authMiddleware, require('./api/routes/cameras'));
app.use('/api/fines', authMiddleware, require('./api/routes/fines'));
app.use('/api/fine-rules', authMiddleware, require('./api/routes/fineRules'));
app.use('/api/salaries', authMiddleware, require('./api/routes/salaries'));
app.use('/api/loans', authMiddleware, require('./api/routes/loans'));
app.use('/api/shifts', authMiddleware, require('./api/routes/shifts'));
app.use('/api/dashboard', authMiddleware, require('./api/routes/dashboard'));
app.use('/api/analytics', authMiddleware, require('./api/routes/analytics'));
app.use('/api/privacy', authMiddleware, require('./api/routes/privacy'));
app.use('/api/notifications', authMiddleware, require('./api/routes/notifications'));
app.use('/api/insights', authMiddleware, require('./api/routes/insights'));
app.use('/api/geofence', authMiddleware, require('./api/routes/geofence'));
app.use('/api/leaves', authMiddleware, require('./api/routes/leaves'));

// ─── Error Handling ───────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Socket.IO Auth ───────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-in-production');
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id} (user: ${socket.userId})`);
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// ─── Start Server ─────────────────────────────────────────────────
const start = async () => {
  try {
    await connectDB();

    // Connect cache (non-blocking — falls back to in-memory if Redis unavailable)
    const cacheService = require('./services/cache/CacheService');
    await cacheService.connect();

    // Create additional indexes (non-blocking, non-fatal)
    const createIndexes = require('./config/databaseIndexes');
    createIndexes().catch(err => logger.error('Index creation failed (non-fatal):', err));

    // Initialize leave policies
    const LeaveService = require('./services/hr/LeaveService');
    LeaveService.initDefaultPolicies().catch(err => logger.error('Leave policy init failed (non-fatal):', err));

    // Start cron scheduler
    const initScheduler = require('./cron/scheduler');
    initScheduler();

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Only start if not in test mode
if (process.env.NODE_ENV !== 'test') {
  start();
}

module.exports = { app, server, io };
