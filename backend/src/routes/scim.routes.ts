import { Router, Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/user.model.js';
import { GroupModel } from '../models/group.model.js';
import { createSCIMError } from '../middleware/errorHandler.js';
import { UsersController } from '../controllers/users.controller.js';
import { GroupsController } from '../controllers/groups.controller.js';

const router = Router();

// RFC 7644 §3.14: reject PUT/PATCH/DELETE when If-Match doesn't match the current version
const ifMatch = (find: (id: string) => { meta_version: number } | undefined) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const want = req.headers['if-match'];
    const current = find(req.params.id as string);
    if (!want || want === '*' || !current) return next();
    const tags = want.split(',').map(t => t.trim());
    if (!tags.includes(`W/"${current.meta_version}"`)) return next(createSCIMError('Resource version does not match If-Match', 412));
    next();
  };
const userMatch = ifMatch(id => UserModel.findById(id));
const groupMatch = ifMatch(id => GroupModel.findById(id));

// User endpoints
router.get('/Users', UsersController.listUsers);
router.get('/Users/:id', UsersController.getUser);
router.post('/Users', UsersController.createUser);
router.put('/Users/:id', userMatch, UsersController.replaceUser);
router.patch('/Users/:id', userMatch, UsersController.patchUser);
router.delete('/Users/:id', userMatch, UsersController.deleteUser);

// Group endpoints
router.get('/Groups', GroupsController.listGroups);
router.get('/Groups/:id', GroupsController.getGroup);
router.post('/Groups', GroupsController.createGroup);
router.put('/Groups/:id', groupMatch, GroupsController.replaceGroup);
router.patch('/Groups/:id', groupMatch, GroupsController.patchGroup);
router.delete('/Groups/:id', groupMatch, GroupsController.deleteGroup);

// ServiceProviderConfig endpoint
router.get('/ServiceProviderConfig', (req, res) => {
  res.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://tools.ietf.org/html/rfc7644',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 1000 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: true },
    authenticationSchemes: [
      {
        type: 'oauthbearertoken',
        name: 'OAuth Bearer Token',
        description: 'Authentication scheme using the OAuth Bearer Token',
        specUri: 'https://tools.ietf.org/html/rfc6750',
        primary: true
      }
    ]
  });
});

// Schemas endpoint
router.get('/Schemas', (req, res) => {
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 2,
    Resources: [
      {
        id: 'urn:ietf:params:scim:schemas:core:2.0:User',
        name: 'User',
        description: 'SCIM User Schema'
      },
      {
        id: 'urn:ietf:params:scim:schemas:core:2.0:Group',
        name: 'Group',
        description: 'SCIM Group Schema'
      }
    ]
  });
});

// ResourceTypes endpoint
router.get('/ResourceTypes', (req, res) => {
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 2,
    Resources: [
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        description: 'User Account',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:User'
      },
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'Group',
        name: 'Group',
        endpoint: '/Groups',
        description: 'Group',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:Group'
      }
    ]
  });
});

export default router;
