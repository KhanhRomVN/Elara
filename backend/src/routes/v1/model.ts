import { Router } from 'express';
import { getModelSequences } from '../../controllers/model.controller';
import { getAllModels } from '../../controllers/models.controller';

const router = Router();

router.get('/', getAllModels);
router.get('/sequences', getModelSequences);

export default router;
