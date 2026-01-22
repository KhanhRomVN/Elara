import { Request, Response } from 'express';
import { getDb } from '../services/db';
import { createLogger } from '../utils/logger';
import { providerRegistry } from '../provider/registry';
import { isProviderEnabled } from '../services/provider.service';

const logger = createLogger('UploadController');

export const uploadFileController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { accountId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Get account
    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE id = ?')
      .get(accountId) as any;

    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const providerId = account.provider_id;
    if (!(await isProviderEnabled(providerId))) {
      res.status(403).json({ error: `Provider ${providerId} is disabled` });
      return;
    }

    const provider = providerRegistry.getProvider(providerId);
    if (!provider) {
      res.status(400).json({ error: `Provider ${providerId} not supported` });
      return;
    }

    if (!provider.uploadFile) {
      res
        .status(400)
        .json({ error: `Provider ${providerId} does not support file upload` });
      return;
    }

    try {
      const result = await provider.uploadFile(account.credential, file);

      const responseData: any = {
        filename: file.originalname,
      };

      if (typeof result === 'string') {
        responseData.file_id = result;
      } else if (result && result.id) {
        responseData.file_id = result.id;
        if (result.token_usage) responseData.token_usage = result.token_usage;
      } else {
        responseData.raw = result;
      }

      res.status(200).json({
        success: true,
        data: responseData,
      });
    } catch (err: any) {
      logger.error(`Error uploading to ${providerId}`, err);
      res.status(500).json({ error: `Upload failed: ${err.message}` });
    }
  } catch (error: any) {
    logger.error('Error in uploadFileController', error);
    res.status(500).json({ error: error.message });
  }
};
