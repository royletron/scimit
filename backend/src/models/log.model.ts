import db from '../config/database.js';

export interface RequestLog {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  status_code: number;
  headers: string;
  query_params: string;
  request_body?: string;
  response_body?: string;
  response_headers: string;
  duration_ms: number;
  ip_address?: string;
  user_agent?: string;
  direction?: string;
  target_id?: number;
}

export class LogModel {
  static findAll(filters?: {
    method?: string;
    status?: number;
    path?: string;
    direction?: string;
    target_id?: number;
    limit?: number;
    offset?: number;
  }): { logs: RequestLog[], total: number } {
    let query = 'SELECT * FROM request_logs WHERE 1=1';
    const params: any[] = [];

    if (filters?.method) {
      query += ' AND method = ?';
      params.push(filters.method);
    }

    if (filters?.status) {
      query += ' AND status_code = ?';
      params.push(filters.status);
    }

    if (filters?.path) {
      query += ' AND path LIKE ?';
      params.push(`%${filters.path}%`);
    }

    if (filters?.direction) {
      query += ' AND direction = ?';
      params.push(filters.direction);
    }

    if (filters?.target_id) {
      query += ' AND target_id = ?';
      params.push(filters.target_id);
    }

    const countStmt = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as count'));
    const { count: total } = countStmt.get(...params) as { count: number };

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(filters?.limit || 100, filters?.offset || 0);

    const stmt = db.prepare(query);
    const logs = stmt.all(...params) as RequestLog[];

    return { logs, total };
  }

  static findById(id: number): RequestLog | undefined {
    const stmt = db.prepare('SELECT * FROM request_logs WHERE id = ?');
    return stmt.get(id) as RequestLog | undefined;
  }

  static findByUserId(userId: string): RequestLog[] {
    const stmt = db.prepare('SELECT * FROM request_logs WHERE user_id = ? ORDER BY timestamp DESC');
    return stmt.all(userId) as RequestLog[];
  }

  static findByGroupId(groupId: string): RequestLog[] {
    const stmt = db.prepare('SELECT * FROM request_logs WHERE group_id = ? ORDER BY timestamp DESC');
    return stmt.all(groupId) as RequestLog[];
  }

  static deleteAll(): void {
    db.prepare('DELETE FROM request_logs').run();
  }
}
