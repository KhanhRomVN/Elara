import { Router } from 'express';
import { providerRegistry } from '../../provider/registry';
import { Provider } from '../../provider/types';

const router = Router();

router.get('/debug/providers', (req, res) => {
  const providers = providerRegistry.getAllProviders();
  res.json({
    count: providers.length,
    providers: providers.map((p: Provider) => ({
      name: p.name,
      hasHandleMessage: typeof p.handleMessage === 'function',
      hasGetConversations: typeof p.getConversations === 'function',
    })),
  });
});

export default router;
