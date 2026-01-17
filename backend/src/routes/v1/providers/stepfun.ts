import express from 'express';
import { getModels } from '../../../stepfun';
import { getAccounts } from '../../../utils/account-utils';

const router = express.Router();

// GET /v1/stepfun/models
router.get('/models', async (req, res) => {
  try {
    const emailQuery = req.query.email as string;
    const accounts = getAccounts();

    // Find account
    const account = accounts.find((a) => a.provider === 'StepFun' && a.email === emailQuery);

    if (account) {
      let cookies = account.credential;
      try {
        cookies = JSON.parse(account.credential);
      } catch (e) {}

      const models = await getModels(cookies);
      res.json({ data: models });
    } else {
      res.json({ data: [] });
    }
  } catch (error: any) {
    console.error('[StepFun] Get Models Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
