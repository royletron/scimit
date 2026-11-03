import db from '../config/database.js';
import { PlaybackModel, PlaybackTarget, PlaybackIdMapping } from '../models/playback.model.js';
import { LogModel } from '../models/log.model.js';
import { UserModel } from '../models/user.model.js';
import { GroupModel } from '../models/group.model.js';
import { broadcast } from './logStream.js';

type SyncAction = 'create' | 'update' | 'delete' | 'unchanged';

const ifMatch = (version?: string | null): Record<string, string> => (version ? { 'If-Match': version } : {});

// RFC 7644 §3.5.2 PatchOp operations turning `prev` (what the SP last accepted) into `next`.
// No baseline (never synced, or linked via lookup) → full replace, including the whole member list.
export function patchOps(prev: any | null, next: any, entityType: 'User' | 'Group'): any[] {
  const ops: any[] = [];
  const skip = new Set(['schemas', 'members']);
  const changed: any = {};
  for (const k of Object.keys(next)) {
    if (!skip.has(k) && JSON.stringify(prev?.[k]) !== JSON.stringify(next[k])) changed[k] = next[k];
  }
  if (Object.keys(changed).length) ops.push({ op: 'replace', value: changed });
  for (const k of Object.keys(prev ?? {})) {
    if (!skip.has(k) && !(k in next)) ops.push({ op: 'remove', path: k });
  }
  if (entityType === 'Group') {
    const members: any[] = next.members ?? [];
    if (!prev) {
      ops.push(members.length ? { op: 'replace', path: 'members', value: members } : { op: 'remove', path: 'members' });
    } else {
      const before = new Set((prev.members ?? []).map((m: any) => m.value));
      const after = new Set(members.map(m => m.value));
      const added = members.filter(m => !before.has(m.value));
      if (added.length) ops.push({ op: 'add', path: 'members', value: added });
      for (const id of before) if (!after.has(id)) ops.push({ op: 'remove', path: `members[value eq ${JSON.stringify(id)}]` });
    }
  }
  return ops;
}

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

  static async playbackEntity(entityType: 'User' | 'Group', scimitId: string, targetId: number, updateMethod: 'PUT' | 'PATCH' = 'PUT') {
    const target = PlaybackModel.findTargetById(targetId);
    if (!target) throw new Error('Target not found');

    const tableName = entityType === 'User' ? 'users' : 'groups';
    const entity = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(scimitId) as any;
    if (!entity) throw new Error(`${entityType} not found`);

    const warnings: string[] = [];
    let body = JSON.parse(entity.raw_data);
    // id/meta are SP-assigned/read-only (RFC 7643 §3.1) — never send ours
    delete body.id;
    delete body.meta;
    // group_members is the source of truth; raw_data members go stale after PATCHes.
    // Members must reference the SP's ids, so unsynced members are omitted rather than sent with our ids.
    if (entityType === 'Group') {
      body.members = GroupModel.getMembers(scimitId).flatMap(m => {
        const mm = PlaybackModel.findMapping(targetId, m.member_id, m.member_type || 'User');
        if (!mm) { warnings.push(`Member ${m.display_name ?? m.member_id} isn't on the target yet; omitted`); return []; }
        return [{ value: mm.target_id_value, type: m.member_type, display: m.display_name ?? undefined }];
      });
    }

    // RFC 7644 §3.3/§3.5.1: requests carry `schemas` — core plus any extension URNs present in the body
    const core = `urn:ietf:params:scim:schemas:core:2.0:${entityType}`;
    body.schemas = [core, ...Object.keys(body).filter(k => k.startsWith('urn:') && k !== core)];

    // Like a real IdP: with no mapping, look the entity up on the target before creating it
    let mapping = PlaybackModel.findMapping(targetId, scimitId, entityType);
    if (!mapping) {
      const attr = entityType === 'User' ? 'userName' : 'displayName';
      // RFC 7644 §3.4.2.2: comparison values are JSON strings, so JSON.stringify gives correct quoting/escaping
      const filter = encodeURIComponent(`${attr} eq ${JSON.stringify(body[attr])}`);
      const found = await this.executePlayback(target, 'GET', `/${entityType}s?filter=${filter}`, null, entityType, scimitId);
      warnings.push(...found.warnings);
      if (found.networkError) return { ...found, action: 'create' as SyncAction, warnings };
      const resources: any[] = found.status === 200 && Array.isArray(found.data?.Resources) ? found.data.Resources : [];
      // userName/displayName are caseExact=false (RFC 7643 §4.1.1, §4.2). Don't trust an SP that ignores the filter.
      const matches = resources.filter(x => String(x?.[attr]).toLowerCase() === String(body[attr]).toLowerCase());
      if (matches.length < resources.length) warnings.push(`GET filter returned ${resources.length - matches.length} resource(s) not matching ${attr} eq ${JSON.stringify(body[attr])} (RFC 7644 §3.4.2.2)`);
      if (matches.length > 1) warnings.push(`GET filter matched ${matches.length} resources for a unique attribute; using the first`);
      if (matches[0]?.id) {
        PlaybackModel.createMapping(target.id, scimitId, matches[0].id, entityType);
        mapping = PlaybackModel.findMapping(targetId, scimitId, entityType)!;
        PlaybackModel.saveSyncState(mapping.id, null, matches[0].meta?.version ?? null);
        mapping = PlaybackModel.findMapping(targetId, scimitId, entityType)!;
      }
    }

    let result;
    let action: SyncAction;
    if (!mapping) {
      action = 'create';
      result = await this.executePlayback(target, 'POST', `/${entityType}s`, body, entityType, scimitId);
    } else if (updateMethod === 'PATCH') {
      const ops = patchOps(mapping.last_synced ? JSON.parse(mapping.last_synced) : null, body, entityType);
      if (ops.length === 0) return { status: 0, data: null, action: 'unchanged' as SyncAction, warnings };
      action = 'update';
      result = await this.executePlayback(target, 'PATCH', `/${entityType}s/${mapping.target_id_value}`,
        { schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: ops }, entityType, scimitId, ifMatch(mapping.version));
    } else {
      action = 'update';
      result = await this.executePlayback(target, 'PUT', `/${entityType}s/${mapping.target_id_value}`, body, entityType, scimitId, ifMatch(mapping.version));
    }

    warnings.push(...result.warnings);
    const saved = PlaybackModel.findMapping(targetId, scimitId, entityType);
    if (saved && result.status >= 200 && result.status < 300) {
      // Remember what the SP accepted (diff base for PATCH) and its version (for If-Match). 204 carries no version.
      PlaybackModel.saveSyncState(saved.id, JSON.stringify(body), result.etag ?? null);
    } else if (saved && result.status === 412) {
      warnings.push('412 Precondition Failed: resource changed on the SP since the last sync (RFC 7644 §3.14). Next sync will send a full update without If-Match.');
      PlaybackModel.saveSyncState(saved.id, null, null);
    }
    return { ...result, action, warnings: [...new Set(warnings)] };
  }

  // Deprovision: DELETE (RFC 7644 §3.6) anything previously pushed to this target that no longer exists locally.
  private static async deleteOrphans(target: PlaybackTarget, entityType: 'User' | 'Group') {
    const table = entityType === 'User' ? 'users' : 'groups';
    const orphans = db.prepare(`
      SELECT m.* FROM playback_id_mappings m
      WHERE m.target_id = ? AND m.entity_type = ? AND NOT EXISTS (SELECT 1 FROM ${table} t WHERE t.id = m.scimit_id)
    `).all(target.id, entityType) as PlaybackIdMapping[];
    const results = [];
    for (const m of orphans) {
      const r = await this.executePlayback(target, 'DELETE', `/${entityType}s/${m.target_id_value}`, null, entityType, m.scimit_id, ifMatch(m.version));
      // 404 = already gone on the SP, which is the outcome we wanted
      if ((r.status >= 200 && r.status < 300) || r.status === 404) PlaybackModel.deleteMapping(m.id);
      const last = m.last_synced ? JSON.parse(m.last_synced) : {};
      results.push({
        entityType, id: m.scimit_id, name: last.userName ?? last.displayName ?? m.target_id_value,
        status: r.status, action: 'delete' as SyncAction,
        warnings: r.status === 412 ? [...r.warnings, '412 Precondition Failed: resource changed on the SP since the last sync (RFC 7644 §3.14)'] : r.warnings,
      });
    }
    return results;
  }

  // Order matters: users first (groups reference their SP ids), then groups, then deletes (groups before users).
  static async syncAll(targetId: number, updateMethod: 'PUT' | 'PATCH' = 'PATCH') {
    const target = PlaybackModel.findTargetById(targetId);
    if (!target) throw new Error('Target not found');
    const results: { entityType: string; id: string; name: string; status: number; action: SyncAction; warnings: string[] }[] = [];
    for (const u of UserModel.findAll(undefined, 1, 1_000_000).users) {
      const r = await this.playbackEntity('User', u.id, targetId, updateMethod);
      results.push({ entityType: 'User', id: u.id, name: u.user_name, status: r.status, action: r.action, warnings: r.warnings });
      if ((r as any).networkError) return results; // SP unreachable: stop rather than repeat the same failure
    }
    for (const g of GroupModel.findAll(undefined, 1, 1_000_000).groups) {
      const r = await this.playbackEntity('Group', g.id, targetId, updateMethod);
      results.push({ entityType: 'Group', id: g.id, name: g.display_name, status: r.status, action: r.action, warnings: r.warnings });
      if ((r as any).networkError) return results;
    }
    results.push(...await this.deleteOrphans(target, 'Group'));
    results.push(...await this.deleteOrphans(target, 'User'));
    return results;
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

  private static async executePlayback(target: PlaybackTarget, method: string, path: string, body: any, entityType: string | null, scimitId: string | null, extraHeaders: Record<string, string> = {}) {
    const startTime = Date.now();
    const url = `${target.url.replace(/\/$/, '')}${path}`;

    const headers: any = {
      'Content-Type': 'application/scim+json',
      'Accept': 'application/scim+json',
    };
    if (target.token) {
      headers['Authorization'] = `Bearer ${target.token}`;
    }
    Object.assign(headers, extraHeaders);

    let response: { status: number; data: unknown; headers: Record<string, string>; networkError?: true };
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
      });

      // Don't trust content-type (application/scim+json, missing, etc.) — parse if it's JSON
      let data: any = await res.text();
      try { data = JSON.parse(data); } catch { /* keep as text */ }

      response = {
        status: res.status,
        data,
        headers: Object.fromEntries(res.headers.entries()),
      };
    } catch (error: any) {
      // No HTTP response at all: status 0, never a made-up 500
      const reason = error.cause?.code ?? error.cause?.message ?? error.message;
      response = {
        status: 0,
        data: { error: `Couldn't reach ${url} (${reason})` },
        headers: {},
        networkError: true,
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
      JSON.stringify(response.data),
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

    // 5. Update mappings if successful creation (any 2xx with an id; non-201 is flagged below)
    if (method === 'POST' && response.status >= 200 && response.status < 300 && entityType && scimitId && (response.data as any)?.id) {
      PlaybackModel.createMapping(target.id, scimitId, (response.data as any).id, entityType);
    }

    return {
      status: response.status,
      data: response.data as any,
      logId: result.lastInsertRowid,
      etag: (response.headers['etag'] ?? (response.data as any)?.meta?.version) as string | undefined,
      networkError: 'networkError' in response,
      warnings: 'networkError' in response
        ? [(response.data as any).error]
        : complianceWarnings(method, response.status, response.headers as Record<string, string>, response.data),
    };
  }
}

// Flags SP responses that break RFC 7644, so a lenient SCIMit doesn't hide SP bugs.
export function complianceWarnings(method: string, status: number, headers: Record<string, string>, data: any): string[] {
  const w: string[] = [];
  const ok = status >= 200 && status < 300;
  const ct = headers['content-type'] ?? '';
  if (status !== 204 && !ct.includes('application/scim+json')) w.push(`Content-Type is "${ct || 'missing'}", expected application/scim+json (RFC 7644 §8.1)`);
  if (status >= 400) {
    if (!data?.schemas?.includes('urn:ietf:params:scim:api:messages:2.0:Error')) w.push('Error response missing urn:ietf:params:scim:api:messages:2.0:Error schema (RFC 7644 §3.12)');
    if (data?.status !== undefined && typeof data.status !== 'string') w.push('Error "status" must be a string (RFC 7644 §3.12)');
    if (status >= 500) w.push(`SP returned ${status}. If the request was invalid, RFC 7644 §3.12 expects a 4xx (e.g. 400 invalidValue), not a 5xx`);
    return w;
  }
  if (method === 'POST') {
    if (ok && status !== 201) w.push(`POST returned ${status}, expected 201 Created (RFC 7644 §3.3)`);
    if (ok && !data?.id) w.push('POST response has no "id" (RFC 7644 §3.3)');
    if (ok && !headers['location']) w.push('POST response has no Location header (RFC 7644 §3.3)');
  }
  if (method === 'PUT' && ok && (status !== 200 || !data?.id)) w.push('PUT must return 200 OK with the updated resource (RFC 7644 §3.5.1)');
  if (method === 'PATCH' && ok && !(status === 204 || (status === 200 && data?.id))) w.push('PATCH must return 200 OK with the resource or 204 No Content (RFC 7644 §3.5.2)');
  if (method === 'DELETE' && ok && status !== 204) w.push(`DELETE returned ${status}, expected 204 No Content (RFC 7644 §3.6)`);
  const version = data?.meta?.version;
  if (ok && version && headers['etag'] && headers['etag'] !== version) w.push(`ETag header ${headers['etag']} doesn't match meta.version ${version} (RFC 7643 §3.1)`);
  if (ok && version && !headers['etag'] && method !== 'GET') w.push('meta.version is set but no ETag header was returned (RFC 7644 §3.14)');
  if (method === 'GET' && ok && !data?.schemas?.includes('urn:ietf:params:scim:api:messages:2.0:ListResponse')) w.push('Query response missing ListResponse schema (RFC 7644 §3.4.2)');
  return w;
}
