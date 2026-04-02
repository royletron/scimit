import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import semver from 'semver';
import { logInfo, logWarn } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to find the package.json starting from the current directory
function findPackageJson(startDir: string): string {
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    const pkgPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      // For monorepo, we want the one with 'scimit' as name
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name === 'scimit') {
        return pkgPath;
      }
    }
    currentDir = path.dirname(currentDir);
  }
  throw new Error('Could not find root package.json');
}

const rootPackagePath = findPackageJson(__dirname);
const pkg = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
export const APP_VERSION = pkg.version;

const dbPath = process.env.DATABASE_PATH || path.join(os.homedir(), '.scimit', 'data.db');

// Ensure the directory for the database exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  // Create schema_info if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_info (
      app_version TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Check if we need to migrate from the old versioned schema_info
  const tableInfo = db.prepare("PRAGMA table_info(schema_info)").all() as any[];
  if (tableInfo.find(c => c.name === 'version')) {
     logInfo('migrating schema_info to semver-only');
     // Get the latest app_version we have recorded
     const latest = db.prepare('SELECT app_version FROM schema_info WHERE app_version IS NOT NULL ORDER BY version DESC LIMIT 1').get() as { app_version: string } | undefined;
     const lastVer = latest?.app_version || '1.1.0'; // Fallback if we can't find it

     db.exec(`
       CREATE TABLE schema_info_new (
         app_version TEXT PRIMARY KEY,
         applied_at TEXT DEFAULT CURRENT_TIMESTAMP
       );
       INSERT INTO schema_info_new (app_version) VALUES ('${lastVer}');
       DROP TABLE schema_info;
       ALTER TABLE schema_info_new RENAME TO schema_info;
     `);
  }

  // Get all applied versions
  const appliedVersions = (db.prepare('SELECT app_version FROM schema_info').all() as { app_version: string }[]).map(v => v.app_version);

  // Check for future versions
  for (const v of appliedVersions) {
    if (semver.gt(v, APP_VERSION)) {
      console.error(`
        🚫 Whoa there, time traveler!
        This database was last used with SCIMit v${v}.
        Current SCIMit version is v${APP_VERSION}.
        Please upgrade SCIMit or use a compatible database.
      `);
      process.exit(1);
    }
  }

  const hasApplied = (v: string) => appliedVersions.includes(v);

  // Apply migrations
  if (!hasApplied('1.1.0') && !db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()) {
    logInfo('initializing database (v1)');
    // Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        external_id TEXT,
        user_name TEXT UNIQUE NOT NULL,
        email_primary TEXT,
        active INTEGER DEFAULT 1,
        raw_data TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        meta_version INTEGER DEFAULT 1
      )
    `);

    // Groups table
    db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        external_id TEXT,
        display_name TEXT NOT NULL,
        raw_data TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        meta_version INTEGER DEFAULT 1
      )
    `);

    // Group members table
    db.exec(`
      CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        member_type TEXT DEFAULT 'User',
        display_name TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        UNIQUE(group_id, member_id)
      )
    `);

    // Request logs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER,
        headers TEXT,
        query_params TEXT,
        request_body TEXT,
        response_body TEXT,
        response_headers TEXT,
        duration_ms INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        direction TEXT DEFAULT 'inbound',
        target_id INTEGER
      )
    `);

    // Bearer tokens table
    db.exec(`
      CREATE TABLE IF NOT EXISTS bearer_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT 'Default Token',
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_used_at TEXT
      )
    `);

    db.prepare('INSERT OR IGNORE INTO schema_info (app_version) VALUES (?)').run('1.1.0');
  }

  if (!hasApplied('1.2.0')) {
    logInfo('migrating database to 1.2.0');
    // Ensure the columns exist (might already be there if user is upgrading from a version that had them but wasn't semver-tracked)
    const logTableInfo = db.prepare("PRAGMA table_info(request_logs)").all() as any[];
    if (!logTableInfo.find(c => c.name === 'user_id')) {
      db.exec("ALTER TABLE request_logs ADD COLUMN user_id TEXT");
    }
    if (!logTableInfo.find(c => c.name === 'group_id')) {
      db.exec("ALTER TABLE request_logs ADD COLUMN group_id TEXT");
    }
    db.prepare('INSERT OR IGNORE INTO schema_info (app_version) VALUES (?)').run('1.2.0');
  }

  if (!hasApplied('1.3.0')) {
    logInfo('migrating database to 1.3.0');
    const logTableInfo = db.prepare("PRAGMA table_info(request_logs)").all() as any[];
    if (!logTableInfo.find(c => c.name === 'direction')) {
      db.exec("ALTER TABLE request_logs ADD COLUMN direction TEXT DEFAULT 'inbound'");
    }
    if (!logTableInfo.find(c => c.name === 'target_id')) {
      db.exec("ALTER TABLE request_logs ADD COLUMN target_id INTEGER");
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS playback_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        token TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS playback_id_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_id INTEGER NOT NULL,
        scimit_id TEXT NOT NULL,
        target_id_value TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_id) REFERENCES playback_targets(id) ON DELETE CASCADE,
        UNIQUE(target_id, scimit_id, entity_type)
      );
    `);
    db.prepare('INSERT OR IGNORE INTO schema_info (app_version) VALUES (?)').run('1.3.0');
  }

  // Ensure current app version is recorded
  db.prepare('INSERT OR IGNORE INTO schema_info (app_version) VALUES (?)').run(APP_VERSION);

  // Generate initial bearer token if none exists
  const tokenCheck = db.prepare('SELECT COUNT(*) as count FROM bearer_tokens WHERE active = 1').get() as { count: number };
  if (tokenCheck.count === 0) {
    const initialToken = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO bearer_tokens (token, description) VALUES (?, ?)').run(initialToken, 'Initial Token');
    logWarn(`new bearer token generated — copy it from the Connector page`);
  }

  logInfo('database ready');
}

export default db;
