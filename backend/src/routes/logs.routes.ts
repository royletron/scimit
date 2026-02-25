import { Router } from 'express';
import { LogsController } from '../controllers/logs.controller.js';

const router = Router();

router.get('/', LogsController.getLogs);
router.get('/stream', LogsController.streamLogs);
router.get('/:id', LogsController.getLog);

export default router;
