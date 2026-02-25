import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';

const router = Router();

router.post('/reset', AdminController.reset);
router.get('/token', AdminController.getToken);
router.post('/token/generate', AdminController.generateNewToken);
router.get('/users', AdminController.getUsers);
router.get('/groups', AdminController.getGroups);

export default router;
