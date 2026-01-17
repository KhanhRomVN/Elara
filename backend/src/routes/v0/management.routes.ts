import express from 'express';

const router = express.Router();

/**
 * GET /v0/management/health
 * Health check endpoint
 */
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'elara-backend',
  });
});

export default router;
