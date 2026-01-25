import express from 'express';
import multer from 'multer';
import { getAccountSelector } from '../../services/account-selector';
import {
  sendMessageController,
  getChatHistoryController,
  completionController,
  claudeMessagesController,
} from '../../controllers/chat.controller';
import { uploadFileController } from '../../controllers/upload.controller';

import { sendMessage, SendMessageOptions } from '../../services/chat.service';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/history/:account_id/:conversation_id', getChatHistoryController);
router.post('/accounts/messages', sendMessageController);
router.post('/accounts/:accountId/messages', sendMessageController);
router.post(
  '/accounts/:accountId/uploads',
  upload.single('file'),
  uploadFileController,
);

router.post('/completions', completionController);

export default router;
