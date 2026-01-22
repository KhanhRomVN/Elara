import { Router } from 'express';
import {
  getAccountConversations,
  getAccountConversationDetail,
} from '../../controllers/chat.controller';

const router = Router();

router.get('/accounts/:accountId/conversations', getAccountConversations);
router.get(
  '/accounts/:accountId/conversations/:conversationId',
  getAccountConversationDetail,
);

export default router;
