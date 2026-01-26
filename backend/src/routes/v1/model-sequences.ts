import { Router } from 'express';
import {
  getModelSequences,
  upsertModelSequence,
  insertModelSequence,
  deleteModelSequence,
} from '../../controllers/model.controller';

const router = Router();

router.get('/', getModelSequences);
router.post('/', upsertModelSequence);
router.post('/insert', insertModelSequence);
router.delete('/:providerId/:modelId', deleteModelSequence);

export default router;
