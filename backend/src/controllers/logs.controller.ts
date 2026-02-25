import { Request, Response, NextFunction } from 'express';
import { LogModel } from '../models/log.model.js';
import { addClient, removeClient } from '../services/logStream.js';

export class LogsController {
  static async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const method = req.query.method as string;
      const status = req.query.status ? parseInt(req.query.status as string) : undefined;
      const path = req.query.path as string;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const { logs, total } = LogModel.findAll({
        method,
        status,
        path,
        limit,
        offset
      });

      res.json({
        logs: logs.map(log => ({
          ...log,
          headers: JSON.parse(log.headers),
          query_params: JSON.parse(log.query_params),
          request_body: log.request_body ? JSON.parse(log.request_body) : null,
          response_body: log.response_body ? JSON.parse(log.response_body) : null,
          response_headers: JSON.parse(log.response_headers)
        })),
        total,
        limit,
        offset
      });
    } catch (error) {
      next(error);
    }
  }

  static streamLogs(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    addClient(res);
    req.on('close', () => removeClient(res));
  }

  static async getLog(req: Request, res: Response, next: NextFunction) {
    try {
      const log = LogModel.findById(parseInt(req.params.id as string));

      if (!log) {
        return res.status(404).json({ error: 'Log not found' });
      }

      res.json({
        ...log,
        headers: JSON.parse(log.headers),
        query_params: JSON.parse(log.query_params),
        request_body: log.request_body ? JSON.parse(log.request_body) : null,
        response_body: log.response_body ? JSON.parse(log.response_body) : null,
        response_headers: JSON.parse(log.response_headers)
      });
    } catch (error) {
      next(error);
    }
  }
}
