import express, { Request, Response } from 'express';
import { getDb } from '@backend/services/db';
import * as fs from 'fs';
import * as path from 'path';

const router = express.Router();

// File extensions to index
const INDEXABLE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.swift',
  '.kt',
  '.scala',
  '.vue',
  '.svelte',
  '.astro',
  '.md',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.html',
  '.css',
  '.scss',
  '.less',
];

// Directories to ignore
const IGNORE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  'target',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
  '.cache',
  'coverage',
  '.idea',
  '.vscode',
  '.vs',
  'bin',
  'obj',
  'packages',
  '.svn',
  'bower_components',
];

const MAX_FILE_SIZE = 500 * 1024;

interface QdrantDatabase {
  id: string;
  name: string;
  endpoint: string;
  api_key: string;
}

// Generate collection name from workspace path (absolute path based)
function getCollectionName(workspacePath: string): string {
  const sanitized = workspacePath
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();

  if (sanitized.length > 50) {
    const hash = Buffer.from(workspacePath)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 20);
    return `ws_${hash}`;
  }

  return `ws_${sanitized}`;
}

// Extract workspace name from path
function getWorkspaceName(workspacePath: string): string {
  return path.basename(workspacePath).toLowerCase();
}

// Get config helper
function getConfigValue(key: string): string {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value || '';
}

// Get RAG config
function getRagConfig() {
  const qdrantDatabasesRaw = getConfigValue('qdrant_databases');
  let qdrantDatabases: QdrantDatabase[] = [];
  try {
    qdrantDatabases = qdrantDatabasesRaw ? JSON.parse(qdrantDatabasesRaw) : [];
  } catch {
    qdrantDatabases = [];
  }

  const geminiApiKeysRaw = getConfigValue('gemini_api_keys');
  let geminiApiKeys: string[] = [];
  try {
    geminiApiKeys = geminiApiKeysRaw ? JSON.parse(geminiApiKeysRaw) : [];
  } catch {
    geminiApiKeys = [];
  }

  return {
    ragEnabled: getConfigValue('rag_enabled') !== 'false',
    qdrantDatabases,
    geminiApiKeys,
    rerankEnabled: getConfigValue('rerank_enabled') === 'true',
  };
}

// Get embedding from Gemini with retry logic
async function getGeminiEmbedding(text: string, apiKey: string, retries = 3): Promise<number[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/gemini-embedding-001',
            content: { parts: [{ text }] },
          }),
        },
      );

      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 2000;
        console.log(`[Indexing] Rate limited, waiting ${waitTime}ms before retry...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Gemini error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding?.values || [];
    } catch (error: any) {
      if (attempt === retries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Max retries exceeded');
}

// Get embedding
async function getEmbedding(
  text: string,
  geminiApiKeys: string[],
  keyIndex: number,
): Promise<number[]> {
  const apiKey = geminiApiKeys[keyIndex % geminiApiKeys.length];
  return getGeminiEmbedding(text, apiKey);
}

// Qdrant operations
async function qdrantCreateCollection(db: QdrantDatabase, name: string, dimensions: number) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (db.api_key) headers['api-key'] = db.api_key;

  // Delete existing
  try {
    await fetch(`${db.endpoint}/collections/${name}`, { method: 'DELETE', headers });
  } catch {
    /* ignore */
  }

  // Create new
  await fetch(`${db.endpoint}/collections/${name}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ vectors: { size: dimensions, distance: 'Cosine' } }),
  });
}

async function qdrantUpsertPoints(db: QdrantDatabase, name: string, points: any[]) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (db.api_key) headers['api-key'] = db.api_key;

  await fetch(`${db.endpoint}/collections/${name}/points`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ points }),
  });
}

async function qdrantSearch(db: QdrantDatabase, name: string, vector: number[], limit: number) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (db.api_key) headers['api-key'] = db.api_key;

  const response = await fetch(`${db.endpoint}/collections/${name}/points/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ vector, limit: limit * 2, with_payload: true }),
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.result || [];
}

async function qdrantGetCollectionInfo(db: QdrantDatabase, name: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (db.api_key) headers['api-key'] = db.api_key;

  const response = await fetch(`${db.endpoint}/collections/${name}`, { method: 'GET', headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Qdrant error: ${response.status}`);
  return response.json();
}

// Get all collections from Qdrant
async function qdrantListCollections(db: QdrantDatabase): Promise<string[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (db.api_key) headers['api-key'] = db.api_key;

  try {
    const response = await fetch(`${db.endpoint}/collections`, { method: 'GET', headers });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.result?.collections || []).map((c: any) => c.name);
  } catch {
    return [];
  }
}

// Rename collection in Qdrant (create alias or recreate with new name)
async function qdrantRenameCollection(
  db: QdrantDatabase,
  oldName: string,
  newName: string,
): Promise<boolean> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (db.api_key) headers['api-key'] = db.api_key;

  try {
    // Qdrant supports aliases - create alias with new name pointing to old collection
    const response = await fetch(`${db.endpoint}/collections/aliases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        actions: [{ rename_alias: { old_alias_name: oldName, new_alias_name: newName } }],
      }),
    });

    // If alias doesn't work, try creating new collection and copying data
    if (!response.ok) {
      // Alternative: Create alias pointing old collection to new name
      const aliasResponse = await fetch(`${db.endpoint}/collections/aliases`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          actions: [{ create_alias: { collection_name: oldName, alias_name: newName } }],
        }),
      });

      if (aliasResponse.ok) {
        console.log(`[Indexing] Created alias ${newName} -> ${oldName}`);
        return true;
      }
    }

    return response.ok;
  } catch (error) {
    console.error('[Indexing] Failed to rename collection:', error);
    return false;
  }
}

// Delete collection
async function qdrantDeleteCollection(db: QdrantDatabase, name: string): Promise<boolean> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (db.api_key) headers['api-key'] = db.api_key;

  try {
    const response = await fetch(`${db.endpoint}/collections/${name}`, {
      method: 'DELETE',
      headers,
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Get collection stats for a database
async function qdrantGetDatabaseStats(
  db: QdrantDatabase,
): Promise<{ collectionCount: number; totalPoints: number }> {
  try {
    const collections = await qdrantListCollections(db);
    let totalPoints = 0;

    for (const name of collections) {
      const info = await qdrantGetCollectionInfo(db, name);
      if (info?.result?.points_count) {
        totalPoints += info.result.points_count;
      }
    }

    return { collectionCount: collections.length, totalPoints };
  } catch {
    return { collectionCount: 0, totalPoints: 0 };
  }
}

// Find the most optimal Qdrant database for new indexing
async function findOptimalDatabase(
  qdrantDatabases: QdrantDatabase[],
): Promise<QdrantDatabase | null> {
  if (qdrantDatabases.length === 0) return null;
  if (qdrantDatabases.length === 1) return qdrantDatabases[0];

  // Get stats for all databases
  const dbStats: { db: QdrantDatabase; stats: { collectionCount: number; totalPoints: number } }[] =
    [];

  for (const db of qdrantDatabases) {
    try {
      const stats = await qdrantGetDatabaseStats(db);
      dbStats.push({ db, stats });
    } catch {
      // If can't connect, skip this database
    }
  }

  if (dbStats.length === 0) return qdrantDatabases[0];

  // Sort by: fewer collections first, then fewer points
  dbStats.sort((a, b) => {
    if (a.stats.collectionCount !== b.stats.collectionCount) {
      return a.stats.collectionCount - b.stats.collectionCount;
    }
    return a.stats.totalPoints - b.stats.totalPoints;
  });

  console.log(
    `[Indexing] Selected optimal database: ${dbStats[0].db.name} (${dbStats[0].stats.collectionCount} collections, ${dbStats[0].stats.totalPoints} points)`,
  );
  return dbStats[0].db;
}

// Find collection by exact workspace path
async function findCollectionByExactPath(
  workspacePath: string,
  qdrantDatabases: QdrantDatabase[],
): Promise<{ database: QdrantDatabase; collection: string; pointCount: number } | null> {
  const collectionName = getCollectionName(workspacePath);

  for (const db of qdrantDatabases) {
    try {
      const info = await qdrantGetCollectionInfo(db, collectionName);
      if (info && info.result?.points_count > 0) {
        return { database: db, collection: collectionName, pointCount: info.result.points_count };
      }
    } catch {
      // Continue to next database
    }
  }

  return null;
}

// Find collections by workspace name (basename match)
async function findCollectionsByWorkspaceName(
  workspacePath: string,
  qdrantDatabases: QdrantDatabase[],
): Promise<{ database: QdrantDatabase; collection: string; pointCount: number }[]> {
  const workspaceName = getWorkspaceName(workspacePath);
  const results: { database: QdrantDatabase; collection: string; pointCount: number }[] = [];

  for (const db of qdrantDatabases) {
    try {
      const collections = await qdrantListCollections(db);

      for (const collection of collections) {
        if (!collection.startsWith('ws_')) continue;

        // Check if collection name contains the workspace name
        const collectionLower = collection.toLowerCase();
        if (
          collectionLower.includes(workspaceName) ||
          collectionLower.endsWith(`_${workspaceName}`)
        ) {
          const info = await qdrantGetCollectionInfo(db, collection);
          if (info && info.result?.points_count > 0) {
            results.push({
              database: db,
              collection,
              pointCount: info.result.points_count,
            });
          }
        }
      }
    } catch (error) {
      console.error(`[Indexing] Failed to search in ${db.name}:`, error);
    }
  }

  return results;
}

// Get indexable files with mtime
function getIndexableFilesWithMtime(dirPath: string): { path: string; mtime: number }[] {
  const files: { path: string; mtime: number }[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
          files.push(...getIndexableFilesWithMtime(fullPath));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (INDEXABLE_EXTENSIONS.includes(ext)) {
          const stats = fs.statSync(fullPath);
          if (stats.size <= MAX_FILE_SIZE) {
            files.push({ path: fullPath, mtime: stats.mtimeMs });
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return files;
}

// Get indexed files from Qdrant
async function getIndexedFiles(
  db: QdrantDatabase,
  collectionName: string,
): Promise<Map<string, { mtime?: number; pointIds: string[] }>> {
  const indexedFiles = new Map<string, { mtime?: number; pointIds: string[] }>();

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (db.api_key) headers['api-key'] = db.api_key;

    let offset: number | null = null;
    const limit = 100;

    while (true) {
      const body: any = { limit, with_payload: ['file_path', 'mtime'] };
      if (offset !== null) body.offset = offset;

      const response = await fetch(`${db.endpoint}/collections/${collectionName}/points/scroll`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) break;

      const data = await response.json();
      const points = data.result?.points || [];

      for (const point of points) {
        const filePath = point.payload?.file_path;
        if (filePath) {
          const existing = indexedFiles.get(filePath);
          if (existing) {
            existing.pointIds.push(String(point.id));
          } else {
            indexedFiles.set(filePath, {
              mtime: point.payload?.mtime,
              pointIds: [String(point.id)],
            });
          }
        }
      }

      offset = data.result?.next_page_offset;
      if (!offset || points.length < limit) break;
    }
  } catch (error) {
    console.error('[Indexing] Failed to get indexed files:', error);
  }

  return indexedFiles;
}

// Check index status
async function checkIndexStatus(
  workspacePath: string,
  config: ReturnType<typeof getRagConfig>,
): Promise<{
  indexed: boolean;
  configured: boolean;
  pointCount?: number;
  message?: string;
  needsSync?: boolean;
  syncStats?: { added: number; modified: number; deleted: number };
  activeDatabase?: { id: string; name: string };
  matchingCollections?: {
    databaseId: string;
    databaseName: string;
    collection: string;
    pointCount: number;
  }[];
  requiresAction?: 'none' | 'rename' | 'delete_duplicate';
}> {
  if (!config.ragEnabled) {
    return { indexed: false, configured: false, message: 'RAG is disabled' };
  }

  if (config.qdrantDatabases.length === 0) {
    return { indexed: false, configured: false, message: 'No Qdrant databases configured' };
  }

  if (config.geminiApiKeys.length === 0) {
    return { indexed: false, configured: false, message: 'No Gemini API keys configured' };
  }

  try {
    // Step 1: Try to find collection by exact path
    const exactMatch = await findCollectionByExactPath(workspacePath, config.qdrantDatabases);

    if (exactMatch) {
      // Found exact match - check sync status
      const indexedFiles = await getIndexedFiles(exactMatch.database, exactMatch.collection);
      const currentFiles = getIndexableFilesWithMtime(workspacePath);

      const currentFilesMap = new Map<string, number>();
      for (const file of currentFiles) {
        const relativePath = path.relative(workspacePath, file.path);
        currentFilesMap.set(relativePath, file.mtime);
      }

      let added = 0,
        modified = 0,
        deleted = 0;

      for (const [relativePath, mtime] of currentFilesMap) {
        const indexed = indexedFiles.get(relativePath);
        if (!indexed) {
          added++;
        } else if (indexed.mtime && mtime > indexed.mtime) {
          modified++;
        }
      }

      for (const [relativePath] of indexedFiles) {
        if (!currentFilesMap.has(relativePath)) {
          deleted++;
        }
      }

      const needsSync = added > 0 || modified > 0 || deleted > 0;

      return {
        indexed: true,
        configured: true,
        pointCount: exactMatch.pointCount,
        needsSync,
        syncStats: { added, modified, deleted },
        activeDatabase: { id: exactMatch.database.id, name: exactMatch.database.name },
        requiresAction: 'none',
      };
    }

    // Step 2: No exact match - search by workspace name
    const nameMatches = await findCollectionsByWorkspaceName(workspacePath, config.qdrantDatabases);

    if (nameMatches.length === 0) {
      // No matches at all - need to index
      return {
        indexed: false,
        configured: true,
        message: 'Collection not found',
        requiresAction: 'none',
      };
    }

    if (nameMatches.length === 1) {
      // Found exactly 1 matching collection - can rename
      return {
        indexed: false,
        configured: true,
        message: 'Found collection with same workspace name, needs path update',
        matchingCollections: nameMatches.map((m) => ({
          databaseId: m.database.id,
          databaseName: m.database.name,
          collection: m.collection,
          pointCount: m.pointCount,
        })),
        requiresAction: 'rename',
      };
    }

    // Multiple matches - user needs to delete duplicates
    return {
      indexed: false,
      configured: true,
      message: 'Multiple collections found with same workspace name',
      matchingCollections: nameMatches.map((m) => ({
        databaseId: m.database.id,
        databaseName: m.database.name,
        collection: m.collection,
        pointCount: m.pointCount,
      })),
      requiresAction: 'delete_duplicate',
    };
  } catch (error: any) {
    return { indexed: false, configured: false, message: error.message };
  }
}

// GET /v1/indexing/status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { workspace_path } = req.query;

    if (!workspace_path || typeof workspace_path !== 'string') {
      res.status(400).json({ success: false, message: 'workspace_path required' });
      return;
    }

    const config = getRagConfig();
    const status = await checkIndexStatus(workspace_path, config);
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /v1/indexing/rename - Rename collection to match new workspace path
router.post('/rename', async (req: Request, res: Response) => {
  try {
    const { workspace_path, database_id, old_collection } = req.body;

    if (!workspace_path || !database_id || !old_collection) {
      res
        .status(400)
        .json({
          success: false,
          message: 'workspace_path, database_id, and old_collection required',
        });
      return;
    }

    const config = getRagConfig();
    const targetDb = config.qdrantDatabases.find((db) => db.id === database_id);

    if (!targetDb) {
      res.status(400).json({ success: false, message: 'Database not found' });
      return;
    }

    const newCollectionName = getCollectionName(workspace_path);

    // Create alias from new name to old collection
    const success = await qdrantRenameCollection(targetDb, old_collection, newCollectionName);

    if (success) {
      res.json({
        success: true,
        message: 'Collection renamed successfully',
        data: { oldCollection: old_collection, newCollection: newCollectionName },
      });
    } else {
      res.status(500).json({ success: false, message: 'Failed to rename collection' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /v1/indexing/delete-collection - Delete a collection
router.post('/delete-collection', async (req: Request, res: Response) => {
  try {
    const { database_id, collection } = req.body;

    if (!database_id || !collection) {
      res.status(400).json({ success: false, message: 'database_id and collection required' });
      return;
    }

    const config = getRagConfig();
    const targetDb = config.qdrantDatabases.find((db) => db.id === database_id);

    if (!targetDb) {
      res.status(400).json({ success: false, message: 'Database not found' });
      return;
    }

    const success = await qdrantDeleteCollection(targetDb, collection);

    if (success) {
      res.json({ success: true, message: 'Collection deleted successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to delete collection' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get indexable files
function getIndexableFiles(dirPath: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
          files.push(...getIndexableFiles(fullPath));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (INDEXABLE_EXTENSIONS.includes(ext)) {
          const stats = fs.statSync(fullPath);
          if (stats.size <= MAX_FILE_SIZE) {
            files.push(fullPath);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return files;
}

// POST /v1/indexing/start
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { workspace_path } = req.body;

    if (!workspace_path) {
      res.status(400).json({ success: false, message: 'workspace_path required' });
      return;
    }

    const config = getRagConfig();

    if (!config.ragEnabled) {
      res.status(400).json({ success: false, message: 'RAG is disabled' });
      return;
    }

    if (config.qdrantDatabases.length === 0) {
      res.status(400).json({ success: false, message: 'No Qdrant databases configured' });
      return;
    }

    if (config.geminiApiKeys.length === 0) {
      res.status(400).json({ success: false, message: 'No Gemini API keys configured' });
      return;
    }

    // Find optimal database for new indexing
    const targetDb = await findOptimalDatabase(config.qdrantDatabases);

    if (!targetDb) {
      res.status(400).json({ success: false, message: 'No available Qdrant database' });
      return;
    }

    res.json({
      success: true,
      message: 'Indexing started',
      data: { workspace_path, database: targetDb.name },
    });

    // Background indexing
    (async () => {
      try {
        const files = getIndexableFiles(workspace_path);
        console.log(`[Indexing] Found ${files.length} files, using ${targetDb.name}`);

        if (files.length === 0) return;

        const collectionName = getCollectionName(workspace_path);

        // Create collection (Gemini embedding has 3072 dimensions)
        await qdrantCreateCollection(targetDb, collectionName, 3072);

        const points: any[] = [];
        let keyIndex = 0;

        for (let i = 0; i < files.length; i++) {
          const filePath = files[i];
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const relativePath = path.relative(workspace_path, filePath);

            // Chunk by ~2000 chars
            const chunks: string[] = [];
            for (let j = 0; j < content.length; j += 2000) {
              chunks.push(content.slice(j, j + 2000));
            }

            for (let c = 0; c < chunks.length; c++) {
              const embeddingText = `File: ${relativePath}\n${chunks[c]}`;
              const vector = await getEmbedding(embeddingText, config.geminiApiKeys, keyIndex);
              keyIndex++;

              points.push({
                id: i * 100 + c + 1,
                vector,
                payload: {
                  file_path: relativePath,
                  full_path: filePath,
                  chunk_index: c,
                  content: chunks[c].slice(0, 1000),
                  mtime: fs.statSync(filePath).mtimeMs,
                },
              });

              // Batch upsert
              if (points.length >= 10) {
                await qdrantUpsertPoints(targetDb, collectionName, points);
                points.length = 0;
              }

              await new Promise((r) => setTimeout(r, 500));
            }
          } catch (err) {
            console.error(`[Indexing] Failed to process ${filePath}:`, err);
          }
        }

        // Upsert remaining
        if (points.length > 0) {
          await qdrantUpsertPoints(targetDb, collectionName, points);
        }

        console.log(`[Indexing] Complete for ${workspace_path}`);
      } catch (err) {
        console.error('[Indexing] Failed:', err);
      }
    })();
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /v1/indexing/sync - Incremental sync
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { workspace_path } = req.body;

    if (!workspace_path) {
      res.status(400).json({ success: false, message: 'workspace_path required' });
      return;
    }

    const config = getRagConfig();

    if (!config.ragEnabled) {
      res.status(400).json({ success: false, message: 'RAG is disabled' });
      return;
    }

    // Find existing collection by exact path
    const found = await findCollectionByExactPath(workspace_path, config.qdrantDatabases);
    if (!found) {
      res.status(400).json({ success: false, message: 'Collection not found, please index first' });
      return;
    }

    res.json({
      success: true,
      message: 'Sync started',
      data: { workspace_path, database: found.database.name },
    });

    // Background sync
    (async () => {
      try {
        const collectionName = found.collection;
        const targetDb = found.database;

        // Get indexed files
        const indexedFiles = await getIndexedFiles(targetDb, collectionName);
        const currentFiles = getIndexableFilesWithMtime(workspace_path);

        const currentFilesMap = new Map<string, { fullPath: string; mtime: number }>();
        for (const file of currentFiles) {
          const relativePath = path.relative(workspace_path, file.path);
          currentFilesMap.set(relativePath, { fullPath: file.path, mtime: file.mtime });
        }

        const toAdd: { relativePath: string; fullPath: string; mtime: number }[] = [];
        const toUpdate: {
          relativePath: string;
          fullPath: string;
          mtime: number;
          oldPointIds: string[];
        }[] = [];
        const toDelete: string[] = [];

        for (const [relativePath, fileInfo] of currentFilesMap) {
          const indexed = indexedFiles.get(relativePath);
          if (!indexed) {
            toAdd.push({ relativePath, fullPath: fileInfo.fullPath, mtime: fileInfo.mtime });
          } else if (indexed.mtime && fileInfo.mtime > indexed.mtime) {
            toUpdate.push({
              relativePath,
              fullPath: fileInfo.fullPath,
              mtime: fileInfo.mtime,
              oldPointIds: indexed.pointIds,
            });
          }
        }

        for (const [relativePath, indexed] of indexedFiles) {
          if (!currentFilesMap.has(relativePath)) {
            toDelete.push(...indexed.pointIds);
          }
        }

        console.log(
          `[Indexing Sync] Add: ${toAdd.length}, Update: ${toUpdate.length}, Delete: ${toDelete.length} points`,
        );

        // Delete removed files and old points
        const allPointsToDelete = [...toDelete, ...toUpdate.flatMap((f) => f.oldPointIds)];
        if (allPointsToDelete.length > 0) {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (targetDb.api_key) headers['api-key'] = targetDb.api_key;

          await fetch(`${targetDb.endpoint}/collections/${collectionName}/points/delete`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ points: allPointsToDelete.map((id) => parseInt(id) || id) }),
          });
          console.log(`[Indexing Sync] Deleted ${allPointsToDelete.length} points`);
        }

        // Process new and updated files
        const filesToProcess = [
          ...toAdd,
          ...toUpdate.map((f) => ({
            relativePath: f.relativePath,
            fullPath: f.fullPath,
            mtime: f.mtime,
          })),
        ];

        if (filesToProcess.length === 0) {
          console.log('[Indexing Sync] No files to process');
          return;
        }

        let maxPointId = 0;
        for (const [, indexed] of indexedFiles) {
          for (const id of indexed.pointIds) {
            const numId = parseInt(id);
            if (!isNaN(numId) && numId > maxPointId) maxPointId = numId;
          }
        }

        const points: any[] = [];
        let keyIndex = 0;
        let nextPointId = maxPointId + 1;

        for (const file of filesToProcess) {
          try {
            const content = fs.readFileSync(file.fullPath, 'utf-8');

            const chunks: string[] = [];
            for (let j = 0; j < content.length; j += 2000) {
              chunks.push(content.slice(j, j + 2000));
            }

            for (let c = 0; c < chunks.length; c++) {
              const embeddingText = `File: ${file.relativePath}\n${chunks[c]}`;
              const vector = await getEmbedding(embeddingText, config.geminiApiKeys, keyIndex);
              keyIndex++;

              points.push({
                id: nextPointId++,
                vector,
                payload: {
                  file_path: file.relativePath,
                  full_path: file.fullPath,
                  chunk_index: c,
                  content: chunks[c].slice(0, 1000),
                  mtime: file.mtime,
                },
              });

              if (points.length >= 10) {
                await qdrantUpsertPoints(targetDb, collectionName, points);
                points.length = 0;
              }

              await new Promise((r) => setTimeout(r, 500));
            }
          } catch (err) {
            console.error(`[Indexing Sync] Failed to process ${file.fullPath}:`, err);
          }
        }

        if (points.length > 0) {
          await qdrantUpsertPoints(targetDb, collectionName, points);
        }

        console.log(`[Indexing Sync] Complete for ${workspace_path}`);
      } catch (err) {
        console.error('[Indexing Sync] Failed:', err);
      }
    })();
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /v1/indexing/search
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { workspace_path, query, limit = 10 } = req.body;

    if (!workspace_path || !query) {
      res.status(400).json({ success: false, message: 'workspace_path and query required' });
      return;
    }

    const config = getRagConfig();

    if (!config.ragEnabled) {
      res.json({ success: true, data: { files: [] } });
      return;
    }

    if (config.geminiApiKeys.length === 0) {
      res.json({ success: true, data: { files: [] } });
      return;
    }

    // Find collection by exact path
    const found = await findCollectionByExactPath(workspace_path, config.qdrantDatabases);
    if (!found) {
      res.json({ success: true, data: { files: [] } });
      return;
    }

    const queryVector = await getEmbedding(query, config.geminiApiKeys, 0);
    let results = await qdrantSearch(found.database, found.collection, queryVector, limit);

    results = results.map((r: any) => ({
      path: r.payload?.file_path || '',
      content: r.payload?.content || '',
      score: r.score || 0,
    }));

    // Limit to requested count
    results = results.slice(0, limit);

    res.json({
      success: true,
      data: {
        files: results.map((r: any) => ({
          path: r.path,
          snippet: r.content,
          score: r.score,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
