import db from '../config/database.js';
import { PlaybackModel, PlaybackTarget } from '../models/playback.model.js';
import { LogModel } from '../models/log.model.js';
import { broadcast } from './logStream.js';

export class PlaybackService {
  static async playbackLog(logId: number, targetId: number) {
    const log = LogModel.findById(logId);
    if (!log) throw new Error('Log not found');

    const target = PlaybackModel.findTargetById(targetId);
    if (!target) throw new Error('Target not found');

    const { method, path, request_body } = log;
    let body = request_body ? JSON.parse(request_body) : null;
    let targetPath = path;

    // 1. Identify entity type and Scimit ID from path
    const userMatch = path.match(/\/Users\/([^\/]+)/);
    const groupMatch = path.match(/\/Groups\/([^\/]+)/);

    let entityType: string | null = null;
    let scimitId: string | null = null;

    if (userMatch) {
      entityType = 'User';
      scimitId = userMatch[1];
    } else if (groupMatch) {
      entityType = 'Group';
      scimitId = groupMatch[1];
    } else if (path.endsWith('/Users')) {
        entityType = 'User';
    } else if (path.endsWith('/Groups')) {
        entityType = 'Group';
    }

    // 2. Perform ID substitutions
    targetPath = this.substituteIdsInPath(targetPath, targetId, entityType);
    if (body) {
      body = this.substituteIdsInBody(body, targetId);
    }

    // 3. Execute request
    return await this.executePlayback(target, method, targetPath, body, entityType, scimitId);
  }

  static async playbackEntity(entityType: 'User' | 'Group', scimitId: string, targetId: number) {
    const target = PlaybackModel.findTargetById(targetId);
    if (!target) throw new Error('Target not found');

    const mapping = PlaybackModel.findMapping(targetId, scimitId, entityType);

    let method: string;
    let path: string;
    let body: any;

    const tableName = entityType === 'User' ? 'users' : 'groups';
    const entity = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(scimitId) as any;
    if (!entity) throw new Error(`${entityType} not found`);

    body = JSON.parse(entity.raw_data);
    // Remove SCIMit internal IDs if they exist in raw_data to let target assign its own or use our mapping
    delete body.id;
    delete body.meta;

    if (mapping) {
      method = 'PUT';
      path = `/${entityType}s/${mapping.target_id_value}`;
    } else {
      method = 'POST';
      path = `/${entityType}s`;
    }

    // Substitute IDs for members etc.
    body = this.substituteIdsInBody(body, targetId);

    return await this.executePlayback(target, method, path, body, entityType, scimitId);
  }

  private static substituteIdsInPath(path: string, targetId: number, entityType: string | null): string {
    if (!entityType) return path;

    const parts = path.split('/');
    const idIndex = parts.indexOf(entityType + 's') + 1;

    if (idIndex > 0 && idIndex < parts.length) {
      const scimitId = parts[idIndex];
      const mapping = PlaybackModel.findMapping(targetId, scimitId, entityType);
      if (mapping) {
        parts[idIndex] = mapping.target_id_value;
      }
    }

    return parts.join('/');
  }

  private static substituteIdsInBody(body: any, targetId: number): any {
    if (body.members && Array.isArray(body.members)) {
      body.members = body.members.map((member: any) => {
        const mapping = PlaybackModel.findMapping(targetId, member.value, member.type || 'User');
        if (mapping) {
          return { ...member, value: mapping.target_id_value };
        }
        return member;
      });
    }

    return body;
  }

  private static async executePlayback(target: PlaybackTarget, method: string, path: string, body: any, entityType: string | null, scimitId: string | null) {
    const startTime = Date.now();
    const url = `${target.url.replace(/\/$/, '')}${path}`;

    const headers: any = {
      'Content-Type': 'application/scim+json',
      'Accept': 'application/scim+json',
    };
    if (target.token) {
      headers['Authorization'] = `Bearer ${target.token}`;
    }

    let response;
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
      });

      let data = null;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      response = {
        status: res.status,
        data,
        headers: Object.fromEntries(res.headers.entries()),
      };
    } catch (error: any) {
      response = {
        status: 500,
        data: { error: error.message },
        headers: {},
      };
    }

    const duration = Date.now() - startTime;

    // 4. Log the outbound request
    const result = db.prepare(`
      INSERT INTO request_logs (
        method, path, status_code, headers, query_params,
        request_body, response_body, response_headers,
        duration_ms, direction, target_id, user_id, group_id, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      method,
      path,
      response.status,
      JSON.stringify(headers),
      '{}',
      body ? JSON.stringify(body) : null,
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
      JSON.stringify(response.headers),
      duration,
      'outbound',
      target.id,
      entityType === 'User' ? scimitId : null,
      entityType === 'Group' ? scimitId : null
    );

    const raw = db.prepare('SELECT * FROM request_logs WHERE id = ?').get(result.lastInsertRowid) as any;
    if (raw) {
      broadcast({
        ...raw,
        headers:          JSON.parse(raw.headers),
        query_params:     JSON.parse(raw.query_params),
        request_body:     raw.request_body     ? JSON.parse(raw.request_body)     : null,
        response_body:    raw.response_body    ? JSON.parse(raw.response_body)    : null,
        response_headers: JSON.parse(raw.response_headers),
      });
    }

    // 5. Update mappings if successful creation
    if (response.status === 201 && entityType && scimitId && (response.data as any)?.id) {
      PlaybackModel.createMapping(target.id, scimitId, (response.data as any).id, entityType);
    }

    return {
      status: response.status,
      data: response.data,
      logId: result.lastInsertRowid
    };
  }
}
