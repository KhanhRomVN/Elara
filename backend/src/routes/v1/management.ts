import express from 'express';
import { getDB, Account } from '../../utils/database';

const router = express.Router();
const db = getDB();

// GET /api/v1/management/accounts
router.get('/accounts', async (req, res) => {
  try {
    const accounts = db.getAll();
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/management/accounts/import
router.post('/accounts/import', async (req, res) => {
  try {
    const accounts = req.body;
    if (!Array.isArray(accounts)) {
      res.status(400).json({ error: 'Invalid input: expected an array of accounts' });
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;

    for (const acc of accounts) {
      // Basic validation
      if (!acc.provider || !acc.email || !acc.credential) {
        continue;
      }

      // Check existence
      const existing = db
        .getAll()
        .find((a) => a.id === acc.id || (a.provider === acc.provider && a.email === acc.email));

      if (existing) {
        // Update
        const updated = { ...existing, ...acc, id: existing.id }; // Preserve ID if matching by email/provider
        db.upsert(updated);
        updatedCount++;
      } else {
        // New
        // Ensure defaults
        const newAccount: Account = {
          ...acc,
          id: acc.id || require('crypto').randomUUID(),
          status: acc.status || 'Active',
          usage: acc.usage || '0',
          totalRequests: acc.totalRequests || 0,
          successfulRequests: acc.successfulRequests || 0,
          totalDuration: acc.totalDuration || 0,
          tokensToday: acc.tokensToday || 0,
          statsDate: acc.statsDate || new Date().toISOString().split('T')[0],
          lastActive: acc.lastActive || new Date().toISOString(),
        };
        db.upsert(newAccount);
        addedCount++;
      }
    }

    res.json({ success: true, added: addedCount, updated: updatedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
