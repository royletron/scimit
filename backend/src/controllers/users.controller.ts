import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/user.model.js';
import { formatSCIMUser, formatListResponse } from '../utils/scim-response.js';
import { createSCIMError } from '../middleware/errorHandler.js';

export class UsersController {
  static async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = req.query.filter as string;
      const startIndex = parseInt(req.query.startIndex as string) || 1;
      const count = parseInt(req.query.count as string) || 100;

      const { users, total } = UserModel.findAll(filter, startIndex, count);
      const formattedUsers = users.map(formatSCIMUser);

      res.json(formatListResponse(formattedUsers, total, startIndex, users.length));
    } catch (error) {
      next(error);
    }
  }

  static async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = UserModel.findById(req.params.id as string);

      if (!user) {
        throw createSCIMError('User not found', 404);
      }

      res.json(formatSCIMUser(user));
    } catch (error) {
      next(error);
    }
  }

  static async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userData = req.body;

      if (!userData.userName) {
        throw createSCIMError('userName is required', 400, 'invalidValue');
      }

      // Check if user already exists
      const existing = UserModel.findByUserName(userData.userName);
      if (existing) {
        throw createSCIMError('User with this userName already exists', 409, 'uniqueness');
      }

      const user = UserModel.create(userData);
      const formattedUser = formatSCIMUser(user);

      res.status(201)
        .header('Location', `/scim/v2/Users/${user.id}`)
        .json(formattedUser);
    } catch (error) {
      next(error);
    }
  }

  static async replaceUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userData = req.body;

      if (!userData.userName) {
        throw createSCIMError('userName is required', 400, 'invalidValue');
      }

      const user = UserModel.update(req.params.id as string, userData);

      if (!user) {
        throw createSCIMError('User not found', 404);
      }

      res.json(formatSCIMUser(user));
    } catch (error) {
      next(error);
    }
  }

  static async patchUser(req: Request, res: Response, next: NextFunction) {
    try {
      const operations = req.body.Operations || req.body.operations;

      if (!Array.isArray(operations)) {
        throw createSCIMError('Operations must be an array', 400, 'invalidSyntax');
      }

      const user = UserModel.patch(req.params.id as string, operations);

      if (!user) {
        throw createSCIMError('User not found', 404);
      }

      res.json(formatSCIMUser(user));
    } catch (error) {
      next(error);
    }
  }

  static async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const deleted = UserModel.delete(req.params.id as string);

      if (!deleted) {
        throw createSCIMError('User not found', 404);
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
