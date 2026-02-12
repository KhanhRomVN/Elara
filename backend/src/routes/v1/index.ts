import { Router } from 'express';
import { providerRegistry } from '../../provider/registry';

const router = Router();

// Import route modules
import chatRouter from './chat';
import accountRouter from './account.routes';
import chatHistoryRouter from './chat.routes';
import providerRouter from './provider';
import messagesRouter from './messages';
import debugRouter from './debug';
import configRouter from './config';
import modelRouter from './model';
import statsRouter from './stats';

import modelSequencesRouter from './model-sequences';

// Register routes
router.use('/chat', chatRouter);
router.use('/accounts', accountRouter);
router.use('/providers', providerRouter);
router.use('/messages', messagesRouter);
router.use('/debug', debugRouter);
router.use('/config', configRouter);
router.use('/models', modelRouter);
router.use('/model-sequences', modelSequencesRouter);
router.use('/stats', statsRouter);

// Provider-specific custom routes (e.g., /cohere/sessions)
providerRegistry.registerAllRoutes(router);
router.use('/', chatHistoryRouter); // For /v1/accounts/:accountId/conversations
export default router;
