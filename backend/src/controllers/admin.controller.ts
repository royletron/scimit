import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/user.model.js';
import { GroupModel } from '../models/group.model.js';
import { LogModel } from '../models/log.model.js';
import { generateToken, getActiveToken } from '../utils/token.js';

export class AdminController {
  static async reset(req: Request, res: Response, next: NextFunction) {
    try {
      UserModel.deleteAll();
      GroupModel.deleteAll();
      LogModel.deleteAll();

      res.json({ message: 'All data has been reset successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getToken(req: Request, res: Response, next: NextFunction) {
    try {
      const token = getActiveToken();
      res.json({ token });
    } catch (error) {
      next(error);
    }
  }

  static async generateNewToken(req: Request, res: Response, next: NextFunction) {
    try {
      const description = req.body.description || 'Generated Token';
      const token = generateToken(description);
      res.json({ token, message: 'New token generated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { users } = UserModel.findAll(undefined, 1, 1000);
      res.json(users.map(u => ({
        id: u.id,
        userName: u.user_name,
        emailPrimary: u.email_primary,
        active: u.active === 1,
        externalId: u.external_id,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
        rawData: JSON.parse(u.raw_data)
      })));
    } catch (error) {
      next(error);
    }
  }

  static async getGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const { groups } = GroupModel.findAll(undefined, 1, 1000);
      res.json(groups.map(g => {
        const members = GroupModel.getMembers(g.id);
        return {
          id: g.id,
          displayName: g.display_name,
          externalId: g.external_id,
          createdAt: g.created_at,
          updatedAt: g.updated_at,
          members: members.map(m => ({
            memberId: m.member_id,
            memberType: m.member_type,
            displayName: m.display_name
          })),
          rawData: JSON.parse(g.raw_data)
        };
      }));
    } catch (error) {
      next(error);
    }
  }
}
