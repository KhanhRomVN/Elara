import express from 'express';
import {
  getProviders,
  getProviderModelsController,
} from '../../controllers/provider.controller';

const router = express.Router();

router.get('/', getProviders);
router.get('/:providerId/models', getProviderModelsController);

export default router;
