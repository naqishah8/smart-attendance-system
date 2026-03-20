/**
 * Database Migration System
 *
 * Usage:
 *   node src/migrations/migrate.js up          # Apply all pending migrations
 *   node src/migrations/migrate.js down         # Revert the last applied migration
 *   node src/migrations/migrate.js down --all   # Revert ALL migrations
 *   node src/migrations/migrate.js status       # Show applied/pending migrations
 *
 * Migration files must be in this directory, named like:
 *   20260320000000-description.js
 *
 * Each migration file exports { up(), down() } — both async.
 */
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// Use our DB connection with retry logic
const connectDB = require('../config/database');
const logger = require('../utils/logger');

// Schema for tracking applied migrations
const MigrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  appliedAt: { type: Date, default: Date.now }
});

// Prevent OverwriteModelError if this file is required multiple times
const MigrationModel = mongoose.models.Migration || mongoose.model('Migration', MigrationSchema);

class Migrator {
  /**
   * Load all migration files from this directory (sorted by name).
   */
  async loadMigrationFiles() {
    const files = await fs.readdir(__dirname);
    return files
      .filter(f => f.endsWith('.js') && f !== 'migrate.js')
      .sort();
  }

  /**
   * Get list of already-applied migration names from DB.
   */
  async getApplied() {
    const docs = await MigrationModel.find().sort({ appliedAt: 1 }).lean();
    return docs.map(d => d.name);
  }

  /**
   * Apply all pending (unapplied) migrations in order.
   */
  async up() {
    const files = await this.loadMigrationFiles();
    const applied = await this.getApplied();
    const pending = files.filter(f => !applied.includes(f));

    if (pending.length === 0) {
      logger.info('No pending migrations.');
      return { applied: 0 };
    }

    logger.info(`Found ${pending.length} pending migration(s)`);
    let count = 0;

    for (const file of pending) {
      logger.info(`Applying: ${file}`);
      try {
        const migration = require(path.join(__dirname, file));

        if (typeof migration.up !== 'function') {
          logger.warn(`Skipping ${file}: no up() function exported`);
          continue;
        }

        await migration.up();
        await MigrationModel.create({ name: file });
        count++;
        logger.info(`Applied: ${file}`);
      } catch (error) {
        logger.error(`Migration failed: ${file}`, error);
        logger.error('Stopping migration run. Fix the error and re-run.');
        throw error;
      }
    }

    logger.info(`${count} migration(s) applied successfully`);
    return { applied: count };
  }

  /**
   * Revert the last applied migration (or all if --all flag).
   */
  async down(revertAll = false) {
    const applied = await this.getApplied();

    if (applied.length === 0) {
      logger.info('No migrations to revert.');
      return { reverted: 0 };
    }

    // Determine which migrations to revert
    const toRevert = revertAll ? [...applied].reverse() : [applied[applied.length - 1]];

    logger.info(`Reverting ${toRevert.length} migration(s)`);
    let count = 0;

    for (const name of toRevert) {
      logger.info(`Reverting: ${name}`);
      try {
        const migrationPath = path.join(__dirname, name);

        // Check file still exists
        try {
          await fs.access(migrationPath);
        } catch {
          logger.warn(`Migration file ${name} not found on disk. Removing from tracking only.`);
          await MigrationModel.deleteOne({ name });
          count++;
          continue;
        }

        const migration = require(migrationPath);

        if (typeof migration.down !== 'function') {
          logger.warn(`${name}: no down() function. Removing from tracking only.`);
          await MigrationModel.deleteOne({ name });
          count++;
          continue;
        }

        await migration.down();
        await MigrationModel.deleteOne({ name });
        count++;
        logger.info(`Reverted: ${name}`);
      } catch (error) {
        logger.error(`Revert failed: ${name}`, error);
        throw error;
      }
    }

    logger.info(`${count} migration(s) reverted successfully`);
    return { reverted: count };
  }

  /**
   * Show status of all migrations (applied vs pending).
   */
  async status() {
    const files = await this.loadMigrationFiles();
    const applied = await this.getApplied();

    const results = files.map(file => ({
      name: file,
      status: applied.includes(file) ? 'applied' : 'pending'
    }));

    // Also check for applied migrations whose files are missing
    const missingFiles = applied.filter(name => !files.includes(name));
    for (const name of missingFiles) {
      results.push({ name, status: 'applied (file missing)' });
    }

    return results;
  }
}

// ─── CLI Runner ───────────────────────────────────────────────────

if (require.main === module) {
  const command = process.argv[2];
  const flags = process.argv.slice(3);

  if (!['up', 'down', 'status'].includes(command)) {
    console.log('Usage: node src/migrations/migrate.js <up|down|status> [--all]');
    process.exit(1);
  }

  (async () => {
    try {
      await connectDB();
      const migrator = new Migrator();

      if (command === 'up') {
        await migrator.up();
      } else if (command === 'down') {
        await migrator.down(flags.includes('--all'));
      } else if (command === 'status') {
        const results = await migrator.status();
        console.log('\nMigration Status:');
        console.log('─'.repeat(60));
        for (const r of results) {
          const icon = r.status === 'applied' ? '[x]' : '[ ]';
          console.log(`  ${icon} ${r.name}  (${r.status})`);
        }
        console.log('─'.repeat(60));
        const pending = results.filter(r => r.status === 'pending').length;
        console.log(`  ${results.length} total, ${results.length - pending} applied, ${pending} pending\n`);
      }

      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = Migrator;
