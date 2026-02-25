import { Router } from 'express';
import { UsersController } from '../controllers/users.controller.js';
import { GroupsController } from '../controllers/groups.controller.js';

const router = Router();

// User endpoints
router.get('/Users', UsersController.listUsers);
router.get('/Users/:id', UsersController.getUser);
router.post('/Users', UsersController.createUser);
router.put('/Users/:id', UsersController.replaceUser);
router.patch('/Users/:id', UsersController.patchUser);
router.delete('/Users/:id', UsersController.deleteUser);

// Group endpoints
router.get('/Groups', GroupsController.listGroups);
router.get('/Groups/:id', GroupsController.getGroup);
router.post('/Groups', GroupsController.createGroup);
router.put('/Groups/:id', GroupsController.replaceGroup);
router.patch('/Groups/:id', GroupsController.patchGroup);
router.delete('/Groups/:id', GroupsController.deleteGroup);

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
