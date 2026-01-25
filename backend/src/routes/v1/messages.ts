import express from 'express';
import {
  messagesController,
  countTokensController,
} from '../../controllers/messages.controller';

const router = express.Router();

router.post('/', messagesController);
router.post('/count_tokens', countTokensController);

export default router;
