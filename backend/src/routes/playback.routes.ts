import { Router } from 'express';
import { PlaybackController } from '../controllers/playback.controller.js';

const router = Router();

router.get('/targets', PlaybackController.getTargets);
router.post('/targets', PlaybackController.createTarget);
router.put('/targets/:id', PlaybackController.updateTarget);
router.delete('/targets/:id', PlaybackController.deleteTarget);

router.get('/targets/:targetId/mappings', PlaybackController.getMappings);
router.delete('/mappings/:id', PlaybackController.deleteMapping);
router.get('/entity/:id/mappings', PlaybackController.getEntityMappings);

router.post('/playback-log', PlaybackController.playbackLog);
router.post('/playback-entity', PlaybackController.playbackEntity);

export default router;
