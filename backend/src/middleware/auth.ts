import { Request, Response, NextFunction } from 'express';
import db from '../config/database.js';

export interface AuthenticatedRequest extends Request {
  tokenId?: number;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '401',
      detail: 'Authorization header missing or invalid'
    });
  }

  const token = authHeader.substring(7);

  try {
    const tokenRecord = db.prepare(
      'SELECT id FROM bearer_tokens WHERE token = ? AND active = 1'
    ).get(token) as { id: number } | undefined;

    if (!tokenRecord) {
      return res.status(401).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
        detail: 'Invalid or expired bearer token'
      });
    }

    // Update last used timestamp
    db.prepare('UPDATE bearer_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(tokenRecord.id);

    req.tokenId = tokenRecord.id;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Internal server error'
    });
  }
}
