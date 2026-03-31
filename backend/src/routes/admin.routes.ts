import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';

const router = Router();

router.post('/reset', AdminController.reset);
router.get('/token', AdminController.getToken);
router.post('/token/generate', AdminController.generateNewToken);
router.get('/users', AdminController.getUsers);
router.get('/users/:id/logs', AdminController.getUserLogs);
router.get('/groups', AdminController.getGroups);
router.get('/groups/:id/logs', AdminController.getGroupLogs);

export default router;
