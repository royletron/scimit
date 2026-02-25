import { Request, Response, NextFunction } from 'express';
import { GroupModel } from '../models/group.model.js';
import { formatSCIMGroup, formatListResponse } from '../utils/scim-response.js';
import { createSCIMError } from '../middleware/errorHandler.js';

export class GroupsController {
  static async listGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = req.query.filter as string;
      const startIndex = parseInt(req.query.startIndex as string) || 1;
      const count = parseInt(req.query.count as string) || 100;

      const { groups, total } = GroupModel.findAll(filter, startIndex, count);
      const formattedGroups = groups.map(g => {
        const members = GroupModel.getMembers(g.id);
        return formatSCIMGroup(g, members);
      });

      res.json(formatListResponse(formattedGroups, total, startIndex, groups.length));
    } catch (error) {
      next(error);
    }
  }

  static async getGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const group = GroupModel.findById(req.params.id as string);

      if (!group) {
        throw createSCIMError('Group not found', 404);
      }

      const members = GroupModel.getMembers(group.id);
      res.json(formatSCIMGroup(group, members));
    } catch (error) {
      next(error);
    }
  }

  static async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const groupData = req.body;

      if (!groupData.displayName) {
        throw createSCIMError('displayName is required', 400, 'invalidValue');
      }

      const group = GroupModel.create(groupData);
      const members = GroupModel.getMembers(group.id);
      const formattedGroup = formatSCIMGroup(group, members);

      res.status(201)
        .header('Location', `/scim/v2/Groups/${group.id}`)
        .json(formattedGroup);
    } catch (error) {
      next(error);
    }
  }

  static async replaceGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const groupData = req.body;

      if (!groupData.displayName) {
        throw createSCIMError('displayName is required', 400, 'invalidValue');
      }

      const group = GroupModel.update(req.params.id as string, groupData);

      if (!group) {
        throw createSCIMError('Group not found', 404);
      }

      const members = GroupModel.getMembers(group.id);
      res.json(formatSCIMGroup(group, members));
    } catch (error) {
      next(error);
    }
  }

  static async patchGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const operations = req.body.Operations || req.body.operations;

      if (!Array.isArray(operations)) {
        throw createSCIMError('Operations must be an array', 400, 'invalidSyntax');
      }

      const group = GroupModel.patch(req.params.id as string, operations);

      if (!group) {
        throw createSCIMError('Group not found', 404);
      }

      const members = GroupModel.getMembers(group.id);
      res.json(formatSCIMGroup(group, members));
    } catch (error) {
      next(error);
    }
  }

  static async deleteGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const deleted = GroupModel.delete(req.params.id as string);

      if (!deleted) {
        throw createSCIMError('Group not found', 404);
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
