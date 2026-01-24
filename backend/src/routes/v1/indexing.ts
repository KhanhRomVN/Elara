import { Router, Request, Response } from 'express';
import { getDb } from '../../services/db';
import { createLogger } from '../../utils/logger';
import {
  indexCodebase,
  checkIndexStatus,
  searchRelevantFiles,
} from '../../services/indexing.service';

const router = Router();
const logger = createLogger('IndexingRoutes');

// GET /v1/indexing/status - Check if workspace is indexed
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { workspace_path } = req.query;

    if (!workspace_path || typeof workspace_path !== 'string') {
      res.status(400).json({
        success: false,
        message: 'workspace_path query parameter is required',
      });
      return;
    }

    const db = getDb();

    // Get Qdrant config
    const getConfigValue = (key: string): string => {
      const row = db
        .prepare('SELECT value FROM config WHERE key = ?')
        .get(key) as { value: string } | undefined;
      return row?.value || '';
    };

    const qdrantEndpoint = getConfigValue('qdrant_endpoint');

    if (!qdrantEndpoint) {
      res.json({
        success: true,
        data: {
          indexed: false,
          configured: false,
          message: 'Qdrant endpoint not configured',
        },
      });
      return;
    }

    const status = await checkIndexStatus(
      workspace_path,
      qdrantEndpoint,
      getConfigValue('qdrant_api_key'),
    );

    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    logger.error('Failed to check index status', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check index status',
    });
  }
});

// POST /v1/indexing/start - Start indexing a workspace
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { workspace_path } = req.body;

    if (!workspace_path) {
      res.status(400).json({
        success: false,
        message: 'workspace_path is required',
      });
      return;
    }

    const db = getDb();

    // Get config values
    const getConfigValue = (key: string): string => {
      const row = db
        .prepare('SELECT value FROM config WHERE key = ?')
        .get(key) as { value: string } | undefined;
      return row?.value || '';
    };

    const qdrantEndpoint = getConfigValue('qdrant_endpoint');
    const qdrantApiKey = getConfigValue('qdrant_api_key');
    const geminiApiKeysRaw = getConfigValue('gemini_api_keys');

    if (!qdrantEndpoint) {
      res.status(400).json({
        success: false,
        message:
          'Qdrant endpoint not configured. Please configure in Settings.',
      });
      return;
    }

    let geminiApiKeys: string[] = [];
    try {
      geminiApiKeys = geminiApiKeysRaw ? JSON.parse(geminiApiKeysRaw) : [];
    } catch {
      geminiApiKeys = [];
    }

    if (geminiApiKeys.length === 0) {
      res.status(400).json({
        success: false,
        message:
          'No Gemini API keys configured. Please add at least one in Settings.',
      });
      return;
    }

    // Start indexing in background
    logger.info(`Starting indexing for workspace: ${workspace_path}`);

    // Return immediately, indexing happens in background
    res.json({
      success: true,
      message: 'Indexing started',
      data: {
        workspace_path,
      },
    });

    // Trigger indexing asynchronously
    indexCodebase({
      workspacePath: workspace_path,
      qdrantEndpoint,
      qdrantApiKey,
      geminiApiKeys,
    }).catch((error) => {
      logger.error('Indexing failed', error);
    });
  } catch (error: any) {
    logger.error('Failed to start indexing', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start indexing',
    });
  }
});

// POST /v1/indexing/search - Search relevant files from vector DB
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { workspace_path, query, limit = 10 } = req.body;

    if (!workspace_path || !query) {
      res.status(400).json({
        success: false,
        message: 'workspace_path and query are required',
      });
      return;
    }

    const db = getDb();

    const getConfigValue = (key: string): string => {
      const row = db
        .prepare('SELECT value FROM config WHERE key = ?')
        .get(key) as { value: string } | undefined;
      return row?.value || '';
    };

    const qdrantEndpoint = getConfigValue('qdrant_endpoint');
    const qdrantApiKey = getConfigValue('qdrant_api_key');
    const geminiApiKeysRaw = getConfigValue('gemini_api_keys');

    if (!qdrantEndpoint) {
      res.json({
        success: true,
        data: { files: [] },
      });
      return;
    }

    let geminiApiKeys: string[] = [];
    try {
      geminiApiKeys = geminiApiKeysRaw ? JSON.parse(geminiApiKeysRaw) : [];
    } catch {
      geminiApiKeys = [];
    }

    if (geminiApiKeys.length === 0) {
      res.json({
        success: true,
        data: { files: [] },
      });
      return;
    }

    const results = await searchRelevantFiles({
      workspacePath: workspace_path,
      query,
      limit,
      qdrantEndpoint,
      qdrantApiKey,
      geminiApiKeys,
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    logger.error('Failed to search files', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to search files',
    });
  }
});

export default router;
