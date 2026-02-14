import { Router } from 'express';
import {
  getStats,
  recordMetricsController,
} from '../../controllers/stats.controller';

const router = Router();

router.get('/', getStats);
router.post('/metrics', recordMetricsController);

export default router;
