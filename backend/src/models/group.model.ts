import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface Group {
  id: string;
  external_id?: string;
  display_name: string;
  raw_data: string;
  created_at: string;
  updated_at: string;
  meta_version: number;
}

export interface GroupMember {
  id: number;
  group_id: string;
  member_id: string;
  member_type: string;
  display_name?: string;
}

export class GroupModel {
  static create(groupData: any): Group {
    const id = uuidv4();
    const displayName = groupData.displayName;
    const externalId = groupData.externalId || null;
    const rawData = JSON.stringify(groupData);

    const stmt = db.prepare(`
      INSERT INTO groups (id, external_id, display_name, raw_data)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, externalId, displayName, rawData);

    // Add members if provided
    if (groupData.members && Array.isArray(groupData.members)) {
      for (const member of groupData.members) {
        this.addMember(id, member.value, member.type || 'User', member.display);
      }
    }

    return this.findById(id)!;
  }

  static findById(id: string): Group | undefined {
    const stmt = db.prepare('SELECT * FROM groups WHERE id = ?');
    return stmt.get(id) as Group | undefined;
  }

  static findAll(filter?: string, startIndex: number = 1, count: number = 100): { groups: Group[], total: number } {
    let query = 'SELECT * FROM groups';
    const params: any[] = [];

    if (filter) {
      const filterMatch = filter.match(/displayName\s+eq\s+"([^"]+)"/i);
      if (filterMatch) {
        query += ' WHERE display_name = ?';
        params.push(filterMatch[1]);
      } else {
        const containsMatch = filter.match(/displayName\s+co\s+"([^"]+)"/i);
        if (containsMatch) {
          query += ' WHERE display_name LIKE ?';
          params.push(`%${containsMatch[1]}%`);
        }
      }
    }

    const countStmt = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as count'));
    const { count: total } = countStmt.get(...params) as { count: number };

    query += ' LIMIT ? OFFSET ?';
    params.push(count, startIndex - 1);

    const stmt = db.prepare(query);
    const groups = stmt.all(...params) as Group[];

    return { groups, total };
  }

  static getMembers(groupId: string): GroupMember[] {
    const stmt = db.prepare('SELECT * FROM group_members WHERE group_id = ?');
    return stmt.all(groupId) as GroupMember[];
  }

  static addMember(groupId: string, memberId: string, memberType: string = 'User', displayName?: string): void {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO group_members (group_id, member_id, member_type, display_name)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(groupId, memberId, memberType, displayName || null);
  }

  static removeMember(groupId: string, memberId: string): void {
    const stmt = db.prepare('DELETE FROM group_members WHERE group_id = ? AND member_id = ?');
    stmt.run(groupId, memberId);
  }

  static update(id: string, groupData: any): Group | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const displayName = groupData.displayName || existing.display_name;
    const externalId = groupData.externalId !== undefined ? groupData.externalId : existing.external_id;
    const rawData = JSON.stringify(groupData);
    const newVersion = existing.meta_version + 1;

    const stmt = db.prepare(`
      UPDATE groups
      SET external_id = ?, display_name = ?, raw_data = ?,
          updated_at = CURRENT_TIMESTAMP, meta_version = ?
      WHERE id = ?
    `);

    stmt.run(externalId, displayName, rawData, newVersion, id);

    // Replace members if provided
    if (groupData.members !== undefined) {
      db.prepare('DELETE FROM group_members WHERE group_id = ?').run(id);
      if (Array.isArray(groupData.members)) {
        for (const member of groupData.members) {
          this.addMember(id, member.value, member.type || 'User', member.display);
        }
      }
    }

    return this.findById(id);
  }

  static patch(id: string, operations: any[]): Group | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    for (const op of operations) {
      if (op.op === 'add' && op.path === 'members') {
        const members = Array.isArray(op.value) ? op.value : [op.value];
        for (const member of members) {
          this.addMember(id, member.value, member.type || 'User', member.display);
        }
      } else if (op.op === 'remove' && op.path && op.path.startsWith('members[')) {
        const match = op.path.match(/members\[value eq "([^"]+)"\]/);
        if (match) {
          this.removeMember(id, match[1]);
        }
      } else if (op.op === 'replace' && op.path === 'members') {
        db.prepare('DELETE FROM group_members WHERE group_id = ?').run(id);
        const members = Array.isArray(op.value) ? op.value : [op.value];
        for (const member of members) {
          this.addMember(id, member.value, member.type || 'User', member.display);
        }
      }
    }

    const newVersion = existing.meta_version + 1;
    db.prepare('UPDATE groups SET updated_at = CURRENT_TIMESTAMP, meta_version = ? WHERE id = ?')
      .run(newVersion, id);

    return this.findById(id);
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM groups WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static deleteAll(): void {
    db.prepare('DELETE FROM groups').run();
    db.prepare('DELETE FROM group_members').run();
  }
}
