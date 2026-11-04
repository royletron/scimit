import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { UsersController } from '../controllers/users.controller.js';
import { GroupsController } from '../controllers/groups.controller.js';

const router = Router();

router.post('/reset', AdminController.reset);
router.get('/token', AdminController.getToken);
router.post('/token/generate', AdminController.generateNewToken);
router.get('/users', AdminController.getUsers);
router.get('/users/:id/logs', AdminController.getUserLogs);
router.get('/groups', AdminController.getGroups);
router.get('/groups/:id/logs', AdminController.getGroupLogs);

// IdP mode: author users/groups locally (same validation as SCIM, but not logged as inbound)
router.post('/users', UsersController.createUser);
router.put('/users/:id', UsersController.replaceUser);
router.post('/groups', GroupsController.createGroup);
router.put('/groups/:id', GroupsController.replaceGroup);
// Local delete; the next sync deprovisions it on targets (DELETE)
router.delete('/users/:id', UsersController.deleteUser);
router.put('/users/:id/groups', AdminController.setUserGroups);
router.delete('/groups/:id', GroupsController.deleteGroup);

export default router;
