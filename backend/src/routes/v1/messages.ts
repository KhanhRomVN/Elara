import express from 'express';
import { messagesController } from '../../controllers/messages.controller';

const router = express.Router();

router.post('/', messagesController);

export default router;
