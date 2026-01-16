import express from 'express';

const router = express.Router();

router.get('/conversations', async (_req, res) => {
  res.json([]);
});

router.get('/conversations/:id', async (_req, res) => {
  res.json({ messages: [] });
});

export default router;
