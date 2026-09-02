import { Router } from 'express';
import { providerRegistry } from '../../provider/registry';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    elara: 'khanhromvn/elara',
    timestamp: new Date().toISOString(),
  });
});

// Route modules
import chatRouter from './chat.routes';
import accountRouter from './account.routes';
import loginRouter from './login.routes';
import providerRouter from './provider.routes';
import modelRouter from './model.routes';
import statsRouter from './stats.routes';
import proxyRouter from './proxy.routes';
import uploadRouter from './upload.routes';

// Mount routes
router.use('/chat', chatRouter);
router.use('/accounts/login', loginRouter);
router.use('/accounts', accountRouter);
router.use('/providers', providerRouter);
router.use('/models', modelRouter);
router.use('/stats', statsRouter);
router.use('/proxy', proxyRouter);
router.use('/uploads', uploadRouter);

providerRegistry.registerAllRoutes(router);

export default router;
