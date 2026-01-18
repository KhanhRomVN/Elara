import { Request, Response } from 'express';
import { uploadFile } from '../services/chat/deepseek.service';
import { getDb } from '../services/db';
import { createLogger } from '../utils/logger';

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

    if (account.provider_id.toLowerCase() !== 'deepseek') {
      res
        .status(400)
        .json({ error: 'File upload only supported for DeepSeek currently' });
      return;
    }

    // Upload to DeepSeek
    const result = await uploadFile(
      account.credential,
      file,
      req.headers['user-agent'],
    );

    res.status(200).json({
      success: true,
      data: {
        file_id: result.id,
        token_usage: result.token_usage,
        filename: file.originalname,
      },
    });
  } catch (error: any) {
    logger.error('Error uploading file', error);
    res.status(500).json({ error: error.message });
  }
};
