import { randomBytes } from 'crypto';
import db from '../config/database.js';

export function generateToken(description: string = 'Generated Token'): string {
  const token = randomBytes(32).toString('hex');

  // Deactivate all existing tokens
  db.prepare('UPDATE bearer_tokens SET active = 0').run();

  // Insert new token
  db.prepare('INSERT INTO bearer_tokens (token, description) VALUES (?, ?)').run(token, description);

  return token;
}

export function getActiveToken(): string | null {
  const result = db.prepare('SELECT token FROM bearer_tokens WHERE active = 1 LIMIT 1').get() as { token: string } | undefined;
  return result?.token || null;
}
