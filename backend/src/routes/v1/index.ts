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

// Register routes
router.use('/chat', chatRouter);
router.use('/accounts', accountRouter);
router.use('/providers', providerRouter);
router.use('/messages', messagesRouter);
router.use('/debug', debugRouter);

// Provider-specific custom routes (e.g., /cohere/sessions)
providerRegistry.registerAllRoutes(router);
router.use('/', chatHistoryRouter); // For /v1/accounts/:accountId/conversations
export default router;
