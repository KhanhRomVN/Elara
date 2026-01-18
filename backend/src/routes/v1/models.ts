import express from 'express';

const router = express.Router();

// Mock models list
const MOCK_MODELS = [
  {
    id: 'gpt-4o',
    object: 'model',
    created: 1715367049,
    owned_by: 'system',
  },
  {
    id: 'gpt-4-turbo',
    object: 'model',
    created: 1712361441,
    owned_by: 'system',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    object: 'model',
    created: 1729616400,
    owned_by: 'anthropic',
  },
  {
    id: 'claude-3-opus-20240229',
    object: 'model',
    created: 1709143621,
    owned_by: 'anthropic',
  },
  {
    id: 'deepseek-chat',
    object: 'model',
    created: 1709289600,
    owned_by: 'deepseek',
  },
  {
    id: 'deepseek-reasoner',
    object: 'model',
    created: 1709289600,
    owned_by: 'deepseek',
  },
  {
    id: 'gemini-1.5-pro',
    object: 'model',
    created: 1709289600,
    owned_by: 'google',
  },
];

// GET /v1/models - List all models
router.get('/', async (_req, res) => {
  res.json({
    object: 'list',
    data: MOCK_MODELS,
  });
});

// POST /v1/models/refresh - Mock refresh
router.post('/refresh', async (_req, res) => {
  res.json({
    success: true,
    count: MOCK_MODELS.length,
    message: 'Models list refreshed (mock)',
  });
});

export default router;
