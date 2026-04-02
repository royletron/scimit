import db from '../config/database.js';

export interface PlaybackTarget {
  id: number;
  name: string;
  url: string;
  token?: string;
  created_at: string;
}

export interface PlaybackIdMapping {
  id: number;
  target_id: number;
  scimit_id: string;
  target_id_value: string;
  entity_type: string;
  created_at: string;
}

export class PlaybackModel {
  static createTarget(name: string, url: string, token?: string): PlaybackTarget {
    const stmt = db.prepare('INSERT INTO playback_targets (name, url, token) VALUES (?, ?, ?)');
    const result = stmt.run(name, url, token || null);
    return this.findTargetById(result.lastInsertRowid as number)!;
  }

  static updateTarget(id: number, name: string, url: string, token?: string): PlaybackTarget | undefined {
    const stmt = db.prepare('UPDATE playback_targets SET name = ?, url = ?, token = ? WHERE id = ?');
    stmt.run(name, url, token || null, id);
    return this.findTargetById(id);
  }

  static deleteTarget(id: number): void {
    db.prepare('DELETE FROM playback_targets WHERE id = ?').run(id);
  }

  static findTargetById(id: number): PlaybackTarget | undefined {
    return db.prepare('SELECT * FROM playback_targets WHERE id = ?').get(id) as PlaybackTarget | undefined;
  }

  static findAllTargets(): PlaybackTarget[] {
    return db.prepare('SELECT * FROM playback_targets ORDER BY created_at DESC').all() as PlaybackTarget[];
  }

  static createMapping(target_id: number, scimit_id: string, target_id_value: string, entity_type: string): PlaybackIdMapping {
    const stmt = db.prepare(`
      INSERT INTO playback_id_mappings (target_id, scimit_id, target_id_value, entity_type)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(target_id, scimit_id, entity_type) DO UPDATE SET target_id_value = excluded.target_id_value
    `);
    const result = stmt.run(target_id, scimit_id, target_id_value, entity_type);
    return db.prepare('SELECT * FROM playback_id_mappings WHERE id = ?').get(result.lastInsertRowid || 0) as PlaybackIdMapping;
  }

  static findMapping(target_id: number, scimit_id: string, entity_type: string): PlaybackIdMapping | undefined {
    return db.prepare('SELECT * FROM playback_id_mappings WHERE target_id = ? AND scimit_id = ? AND entity_type = ?')
      .get(target_id, scimit_id, entity_type) as PlaybackIdMapping | undefined;
  }

  static findAllMappingsByTarget(target_id: number): PlaybackIdMapping[] {
    return db.prepare('SELECT * FROM playback_id_mappings WHERE target_id = ? ORDER BY created_at DESC').all(target_id) as PlaybackIdMapping[];
  }

  static deleteMapping(id: number): void {
    db.prepare('DELETE FROM playback_id_mappings WHERE id = ?').run(id);
  }

  static getMappingsByEntity(scimit_id: string): PlaybackIdMapping[] {
    return db.prepare('SELECT m.*, t.name as target_name FROM playback_id_mappings m JOIN playback_targets t ON m.target_id = t.id WHERE m.scimit_id = ?')
      .all(scimit_id) as (PlaybackIdMapping & { target_name: string })[];
  }
}
