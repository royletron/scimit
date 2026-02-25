import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../scim-watch.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
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

  // Generate initial bearer token if none exists
  const tokenCheck = db.prepare('SELECT COUNT(*) as count FROM bearer_tokens WHERE active = 1').get() as { count: number };
  if (tokenCheck.count === 0) {
    const initialToken = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO bearer_tokens (token, description) VALUES (?, ?)').run(initialToken, 'Initial Token');
    console.log('Generated initial bearer token:', initialToken);
  }

  console.log('Database initialized successfully');
}

export default db;
