import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { createSCIMError } from '../middleware/errorHandler.js';

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

  // RFC 7644 §3.5.2. Supports: no path (merge), attr, attr.sub, attr[sub eq "v"], attr[sub eq "v"].sub
  static patch(id: string, operations: any[]): User | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    let userData = JSON.parse(existing.raw_data);

    for (const op of operations) {
      const kind = String(op.op).toLowerCase(); // "op" is case-insensitive in practice (Entra sends "Replace")
      if (!['add', 'replace', 'remove'].includes(kind)) throw createSCIMError(`Unsupported op "${op.op}"`, 400, 'invalidSyntax');
      const path: string | undefined = op.path;

      if (!path) {
        if (kind === 'remove') throw createSCIMError('remove requires a path', 400, 'noTarget');
        userData = { ...userData, ...op.value };
        continue;
      }

      const filtered = path.match(/^([^\[]+)\[(\w+) eq "([^"]*)"\](?:\.(\w+))?$/i);
      if (filtered) {
        const [, attr, key, val, sub] = filtered;
        const arr: any[] = Array.isArray(userData[attr]) ? userData[attr] : (userData[attr] = []);
        let items = arr.filter(x => String(x?.[key]).toLowerCase() === val.toLowerCase());
        if (kind === 'remove') {
          if (sub) items.forEach(x => delete x[sub]);
          else userData[attr] = arr.filter(x => !items.includes(x));
          continue;
        }
        if (items.length === 0) {
          if (kind === 'replace') throw createSCIMError(`No value matches ${path}`, 400, 'noTarget');
          items = [{ [key]: val }];
          arr.push(items[0]);
        }
        items.forEach(x => (sub ? (x[sub] = op.value) : Object.assign(x, op.value)));
        continue;
      }
      if (path.includes('[')) throw createSCIMError(`Unsupported path ${path}`, 400, 'invalidPath');

      // Exact top-level key first (covers extension URNs, which contain dots), else dotted sub-attribute
      const parts = path in userData || !path.includes('.') ? [path] : path.split('.');
      let target = userData;
      for (const part of parts.slice(0, -1)) target = target[part] ??= {};
      const last = parts[parts.length - 1];
      if (kind === 'remove') delete target[last];
      else target[last] = op.value;
    }

    return this.update(id, userData);
  }

  static delete(id: string): boolean {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    // A deleted user is no longer a member of anything
    db.prepare('DELETE FROM group_members WHERE member_id = ?').run(id);
    return result.changes > 0;
  }

  static deleteAll(): void {
    db.prepare('DELETE FROM users').run();
  }
}
