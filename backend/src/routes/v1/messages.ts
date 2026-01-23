import express from 'express';
import { claudeMessagesController } from '../../controllers/chat.controller';

const router = express.Router();

router.post('/', claudeMessagesController);

export default router;
