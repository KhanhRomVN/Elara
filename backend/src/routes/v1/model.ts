import { Router } from 'express';
import { getModelSequences } from '../../controllers/model.controller';

const router = Router();

router.get('/sequences', getModelSequences);

export default router;
