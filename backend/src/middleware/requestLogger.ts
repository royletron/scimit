import { Request, Response, NextFunction } from 'express';
import db from '../config/database.js';
import { broadcast } from '../services/logStream.js';

interface ResponseWithBody extends Response {
  _body?: any;
}

export function requestLogger(req: Request, res: ResponseWithBody, next: NextFunction) {
  const startTime = Date.now();

  // Capture request data
  const requestData = {
    method: req.method,
    path: req.path,
    headers: JSON.stringify(req.headers),
    query_params: JSON.stringify(req.query),
    request_body: req.body ? JSON.stringify(req.body) : null,
    ip_address: req.ip || req.socket.remoteAddress || null,
    user_agent: req.get('user-agent') || null
  };

  // Store original methods
  const originalSend = res.send;
  const originalJson = res.json;

  // Intercept response
  res.send = function (body: any) {
    res._body = body;
    return originalSend.call(this, body);
  };

  res.json = function (body: any) {
    res._body = body;
    return originalJson.call(this, body);
  };

  // Log after response is sent
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    try {
      const result = db.prepare(`
        INSERT INTO request_logs (
          method, path, status_code, headers, query_params,
          request_body, response_body, response_headers,
          duration_ms, ip_address, user_agent, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        requestData.method,
        requestData.path,
        res.statusCode,
        requestData.headers,
        requestData.query_params,
        requestData.request_body,
        res._body || null,
        JSON.stringify(res.getHeaders()),
        duration,
        requestData.ip_address,
        requestData.user_agent
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
    } catch (error) {
      console.error('Failed to log request:', error);
    }
  });

  next();
}
