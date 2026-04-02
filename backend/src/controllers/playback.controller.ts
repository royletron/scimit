import { Request, Response, NextFunction } from 'express';
import { PlaybackModel } from '../models/playback.model.js';
import { PlaybackService } from '../services/playback.service.js';

export class PlaybackController {
  static async getTargets(req: Request, res: Response, next: NextFunction) {
    try {
      const targets = PlaybackModel.findAllTargets();
      res.json(targets);
    } catch (error) {
      next(error);
    }
  }

  static async createTarget(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, url, token } = req.body;
      const target = PlaybackModel.createTarget(name, url, token);
      res.status(201).json(target);
    } catch (error) {
      next(error);
    }
  }

  static async updateTarget(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string);
      const { name, url, token } = req.body;
      const target = PlaybackModel.updateTarget(id, name, url, token);
      if (!target) {
        return res.status(404).json({ message: 'Target not found' });
      }
      res.json(target);
    } catch (error) {
      next(error);
    }
  }

  static async deleteTarget(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string);
      PlaybackModel.deleteTarget(id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  static async getMappings(req: Request, res: Response, next: NextFunction) {
    try {
      const targetId = parseInt(req.params.targetId as string);
      const mappings = PlaybackModel.findAllMappingsByTarget(targetId);
      res.json(mappings);
    } catch (error) {
      next(error);
    }
  }

  static async deleteMapping(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string);
      PlaybackModel.deleteMapping(id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  static async getEntityMappings(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const mappings = PlaybackModel.getMappingsByEntity(id);
      res.json(mappings);
    } catch (error) {
      next(error);
    }
  }

  static async playbackLog(req: Request, res: Response, next: NextFunction) {
    try {
      const { logId, targetId } = req.body;
      const result = await PlaybackService.playbackLog(logId, targetId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async playbackEntity(req: Request, res: Response, next: NextFunction) {
    try {
      const { entityType, scimitId, targetId } = req.body;
      const result = await PlaybackService.playbackEntity(entityType, scimitId, targetId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
