import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  external_id?: string;
  user_name: string;
  email_primary?: string;
  active: number;
  raw_data: string;
  created_at: string;
  updated_at: string;
  meta_version: number;
}

export class UserModel {
  static create(userData: any): User {
    const id = uuidv4();
    const userName = userData.userName;
    const externalId = userData.externalId || null;
    const emailPrimary = userData.emails?.find((e: any) => e.primary)?.value || userName;
    const active = userData.active !== undefined ? (userData.active ? 1 : 0) : 1;
    const rawData = JSON.stringify(userData);

    const stmt = db.prepare(`
      INSERT INTO users (id, external_id, user_name, email_primary, active, raw_data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, externalId, userName, emailPrimary, active, rawData);

    return this.findById(id)!;
  }

  static findById(id: string): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  }

  static findByUserName(userName: string): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE user_name = ?');
    return stmt.get(userName) as User | undefined;
  }

  static findAll(filter?: string, startIndex: number = 1, count: number = 100): { users: User[], total: number } {
    let query = 'SELECT * FROM users';
    const params: any[] = [];

    if (filter) {
      // Basic SCIM filter parsing (userName eq "email")
      const filterMatch = filter.match(/userName\s+eq\s+"([^"]+)"/i);
      if (filterMatch) {
        query += ' WHERE user_name = ?';
        params.push(filterMatch[1]);
      } else {
        // Contains filter
        const containsMatch = filter.match(/userName\s+co\s+"([^"]+)"/i);
        if (containsMatch) {
          query += ' WHERE user_name LIKE ?';
          params.push(`%${containsMatch[1]}%`);
        }
      }
    }

    const countStmt = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as count'));
    const { count: total } = countStmt.get(...params) as { count: number };

    query += ' LIMIT ? OFFSET ?';
    params.push(count, startIndex - 1);

    const stmt = db.prepare(query);
    const users = stmt.all(...params) as User[];

    return { users, total };
  }

  static update(id: string, userData: any): User | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const userName = userData.userName || existing.user_name;
    const externalId = userData.externalId !== undefined ? userData.externalId : existing.external_id;
    const emailPrimary = userData.emails?.find((e: any) => e.primary)?.value || userName;
    const active = userData.active !== undefined ? (userData.active ? 1 : 0) : existing.active;
    const rawData = JSON.stringify(userData);
    const newVersion = existing.meta_version + 1;

    const stmt = db.prepare(`
      UPDATE users
      SET external_id = ?, user_name = ?, email_primary = ?, active = ?, raw_data = ?,
          updated_at = CURRENT_TIMESTAMP, meta_version = ?
      WHERE id = ?
    `);

    stmt.run(externalId, userName, emailPrimary, active, rawData, newVersion, id);

    return this.findById(id);
  }

  static patch(id: string, operations: any[]): User | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    let userData = JSON.parse(existing.raw_data);

    for (const op of operations) {
      if (op.op === 'replace') {
        if (op.path === 'active') {
          userData.active = op.value;
        } else if (op.path) {
          const pathParts = op.path.split('.');
          let target = userData;
          for (let i = 0; i < pathParts.length - 1; i++) {
            target = target[pathParts[i]];
          }
          target[pathParts[pathParts.length - 1]] = op.value;
        } else {
          userData = { ...userData, ...op.value };
        }
      } else if (op.op === 'add') {
        if (op.path) {
          const pathParts = op.path.split('.');
          let target = userData;
          for (let i = 0; i < pathParts.length - 1; i++) {
            target = target[pathParts[i]];
          }
          target[pathParts[pathParts.length - 1]] = op.value;
        }
      }
    }

    return this.update(id, userData);
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static deleteAll(): void {
    db.prepare('DELETE FROM users').run();
  }
}
