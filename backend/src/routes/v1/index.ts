import { Router } from 'express';

const router = Router();

// Import route modules
import chatRouter from './chat';
import modelsRouter from './models';

import managementRouter from './management';
import accountRouter from './account.routes';
import chatHistoryRouter from './chat.routes';

import providerRouter from './provider';

// Register routes
router.use('/chat', chatRouter);
router.use('/models', modelsRouter);
router.use('/management', managementRouter);
router.use('/accounts', accountRouter);
router.use('/providers', providerRouter);
router.use('/', chatHistoryRouter); // For /v1/accounts/:accountId/conversations
export default router;
