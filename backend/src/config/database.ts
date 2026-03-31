import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logWarn } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../scim-watch.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

const APP_SCHEMA_VERSION = 2;

// Initialize database schema
export function initializeDatabase() {
  // Create schema_info if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_info (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get current version
  let currentVersion = 0;
  const row = db.prepare('SELECT MAX(version) as version FROM schema_info').get() as { version: number | null };
  if (row && row.version !== null) {
    currentVersion = row.version;
  } else {
    // Check if we have existing tables to determine if it's version 1
    const usersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (usersTable) {
      currentVersion = 1;
      db.prepare('INSERT INTO schema_info (version) VALUES (1)').run();
    }
  }

  if (currentVersion > APP_SCHEMA_VERSION) {
    console.error(`
      🚫 Whoa there, time traveler!
      This database (v${currentVersion}) is from a future version of SCIMit.
      Current SCIMit version only knows how to handle up to v${APP_SCHEMA_VERSION}.
      Please upgrade SCIMit or use a compatible database.
    `);
    process.exit(1);
  }

  // Apply migrations
  if (currentVersion < 1) {
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
        user_agent TEXT
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

    db.prepare('INSERT INTO schema_info (version) VALUES (1)').run();
    currentVersion = 1;
  }

  if (currentVersion < 2) {
    logInfo('migrating database to v2');
    db.exec(`
      ALTER TABLE request_logs ADD COLUMN user_id TEXT;
      ALTER TABLE request_logs ADD COLUMN group_id TEXT;
    `);
    db.prepare('INSERT INTO schema_info (version) VALUES (2)').run();
    currentVersion = 2;
  }

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
