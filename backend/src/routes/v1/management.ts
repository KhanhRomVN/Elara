import express from 'express';
import { getDB, Account } from '../../utils/database';

const router = express.Router();
const db = getDB();

// GET /api/v1/accounts
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
      res
        .status(400)
        .json({ error: 'Invalid input: expected an array of accounts' });
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;

    for (const acc of accounts) {
      const providerId = acc.provider_id || acc.provider;
      // Basic validation
      if (!providerId || !acc.email || !acc.credential) {
        continue;
      }

      // Check existence
      const existing = db
        .getAll()
        .find(
          (a) =>
            a.id === acc.id ||
            (a.provider_id === providerId && a.email === acc.email),
        );

      if (existing) {
        // Update
        const updated: Account = {
          id: existing.id,
          provider_id: providerId,
          email: acc.email,
          credential: acc.credential,
        };
        db.upsert(updated);
        updatedCount++;
      } else {
        // New
        const newAccount: Account = {
          id: acc.id || require('crypto').randomUUID(),
          provider_id: providerId,
          email: acc.email,
          credential: acc.credential,
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
