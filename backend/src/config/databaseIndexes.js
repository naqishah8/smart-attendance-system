/**
 * Database Index Management
 *
 * Creates optimal indexes beyond what Mongoose schema-level indexes provide.
 * Schema-level indexes (already handled by Mongoose ensureIndexes):
 *   - User: email (unique), employeeId (unique), department, isActive
 *   - Attendance: {userId,date}, {status,date}
 *   - Salary: {userId,month,year} (unique)
 *   - Loan: {userId,status}
 *   - UserShift: {userId,effectiveFrom}
 *
 * This script adds ADDITIONAL indexes for:
 *   - Reporting queries, text search, TTL cleanup, partial filters
 *
 * Run standalone:  node src/config/databaseIndexes.js
 * Or called from:  connectDB() on startup
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function createIndexes() {
  logger.info('Creating additional database indexes...');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.');
  }

  try {
    // ─── Attendance ───────────────────────────────────────────────
    const attendance = db.collection('attendances');

    // Standalone date index for date-range-only queries (dashboard, reports)
    await attendance.createIndex(
      { date: -1 },
      { name: 'idx_date', background: true }
    );

    // Compound index for report queries filtered by present/late status
    await attendance.createIndex(
      { userId: 1, date: -1, status: 1 },
      {
        name: 'idx_user_date_status_partial',
        partialFilterExpression: { status: { $in: ['present', 'late'] } },
        background: true
      }
    );

    // TTL index: auto-expire individual detection snapshots after 90 days
    // NOTE: TTL indexes only work on top-level Date fields, not on array subdocuments.
    // For subdocument cleanup, use PrivacyService.enforceRetentionPolicies() via cron.

    // ─── Fine ─────────────────────────────────────────────────────
    const fines = db.collection('fines');

    await fines.createIndex(
      { userId: 1, createdAt: -1 },
      { name: 'idx_user_created', background: true }
    );

    await fines.createIndex(
      { status: 1 },
      { name: 'idx_status', background: true }
    );

    await fines.createIndex(
      { 'type.ruleId': 1 },
      { name: 'idx_rule', background: true }
    );

    // Idempotency index: prevent duplicate fines for same attendance+rule+detection
    await fines.createIndex(
      { attendanceId: 1, 'type.ruleId': 1, detectionId: 1 },
      { name: 'idx_idempotency', background: true, sparse: true }
    );

    // ─── User ─────────────────────────────────────────────────────
    const users = db.collection('users');

    // Text search index for employee lookup (name, ID)
    await users.createIndex(
      { firstName: 'text', lastName: 'text', employeeId: 'text' },
      { name: 'idx_text_search', background: true }
    );

    // ─── Camera ───────────────────────────────────────────────────
    const cameras = db.collection('cameras');

    await cameras.createIndex(
      { status: 1 },
      { name: 'idx_camera_status', background: true }
    );

    await cameras.createIndex(
      { 'location.zone': 1 },
      { name: 'idx_camera_zone', background: true }
    );

    // ─── Salary ───────────────────────────────────────────────────
    const salaries = db.collection('salaries');

    await salaries.createIndex(
      { paymentStatus: 1, year: -1, month: -1 },
      { name: 'idx_payment_period', background: true }
    );

    // ─── ShiftSwap ────────────────────────────────────────────────
    const shiftswaps = db.collection('shiftswaps');

    await shiftswaps.createIndex(
      { status: 1, date: 1 },
      { name: 'idx_swap_status_date', background: true }
    );

    await shiftswaps.createIndex(
      { requestingUserId: 1, status: 1 },
      { name: 'idx_swap_requester', background: true }
    );

    logger.info('All additional indexes created successfully');
  } catch (error) {
    // Index creation errors are non-fatal — app can still run
    logger.error('Error creating indexes (non-fatal):', error);
  }
}

// Standalone runner
if (require.main === module) {
  const connectDB = require('./database');

  (async () => {
    try {
      await connectDB();
      await createIndexes();
      console.log('Done. Indexes created.');
      process.exit(0);
    } catch (err) {
      console.error('Failed:', err);
      process.exit(1);
    }
  })();
}

module.exports = createIndexes;
