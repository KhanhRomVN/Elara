import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('IndexingService');

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
  '.json',
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

// Max file size to index (500KB)
const MAX_FILE_SIZE = 500 * 1024;

interface CodeChunk {
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  chunkType: 'function' | 'class' | 'module' | 'other';
  name?: string;
}

interface IndexingParams {
  workspacePath: string;
  qdrantEndpoint: string;
  qdrantApiKey: string;
  geminiApiKeys: string[];
}

interface ApiKeyStatus {
  key: string;
  isActive: boolean;
  cooldownUntil: number;
  errorCount: number;
}

class ApiKeyManager {
  private statuses: ApiKeyStatus[];
  private currentIndex: number = 0;

  constructor(keys: string[]) {
    this.statuses = keys.map((key) => ({
      key,
      isActive: true,
      cooldownUntil: 0,
      errorCount: 0,
    }));
  }

  async warmup(): Promise<void> {
    const warmupPromises = this.statuses.map(async (status) => {
      try {
        await getEmbedding('warmup', status.key);
        status.isActive = true;
        logger.info(
          `API Key ${status.key.slice(0, 8)}... warmed up successfully`,
        );
      } catch (error) {
        status.isActive = false;
        logger.warn(
          `API Key ${status.key.slice(0, 8)}... failed warmup: ${error}`,
        );
      }
    });

    await Promise.all(warmupPromises);
  }

  getNextKey(): string | null {
    const now = Date.now();
    const availableStatuses = this.statuses.filter(
      (s) => s.isActive && s.cooldownUntil < now,
    );

    if (availableStatuses.length === 0) {
      // Check if any key is just in cooldown
      const inCooldown = this.statuses.filter((s) => s.isActive);
      if (inCooldown.length > 0) {
        // Find one with earliest cooldown
        const nextReady = inCooldown.sort(
          (a, b) => a.cooldownUntil - b.cooldownUntil,
        )[0];
        return nextReady.key;
      }
      return null;
    }

    const status =
      availableStatuses[this.currentIndex % availableStatuses.length];
    this.currentIndex++;
    return status.key;
  }

  markError(key: string, isRateLimit: boolean): void {
    const status = this.statuses.find((s) => s.key === key);
    if (!status) return;

    status.errorCount++;
    if (isRateLimit) {
      // Cooldown for 1 minute on rate limit
      status.cooldownUntil = Date.now() + 60 * 1000;
      logger.warn(
        `API Key ${key.slice(0, 8)}... rate limited. Cooldown until ${new Date(status.cooldownUntil).toLocaleTimeString()}`,
      );
    } else if (status.errorCount > 3) {
      status.isActive = false;
      logger.error(
        `API Key ${key.slice(0, 8)}... deactivated due to repeated errors`,
      );
    }
  }

  hasActiveKeys(): boolean {
    return this.statuses.some((s) => s.isActive);
  }
}

interface SearchParams {
  workspacePath: string;
  query: string;
  limit: number;
  qdrantEndpoint: string;
  qdrantApiKey: string;
  geminiApiKeys: string[];
}

// Generate collection name from workspace path
function getCollectionName(workspacePath: string): string {
  // Create a safe collection name from the workspace path
  const sanitized = workspacePath
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();

  // Qdrant collection names have limits, so we hash if too long
  if (sanitized.length > 50) {
    const hash = Buffer.from(workspacePath)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 20);
    return `ws_${hash}`;
  }

  return `ws_${sanitized}`;
}

// Check if workspace is indexed in Qdrant
export async function checkIndexStatus(
  workspacePath: string,
  qdrantEndpoint: string,
  qdrantApiKey: string,
): Promise<{
  indexed: boolean;
  configured: boolean;
  pointCount?: number;
  message?: string;
}> {
  try {
    const collectionName = getCollectionName(workspacePath);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (qdrantApiKey) {
      headers['api-key'] = qdrantApiKey;
    }

    const response = await fetch(
      `${qdrantEndpoint}/collections/${collectionName}`,
      {
        method: 'GET',
        headers,
      },
    );

    if (response.status === 404) {
      return {
        indexed: false,
        configured: true,
        message: 'Collection not found',
      };
    }

    if (!response.ok) {
      throw new Error(`Qdrant error: ${response.status}`);
    }

    const data = await response.json();
    const pointCount = data.result?.points_count || 0;

    return {
      indexed: pointCount > 0,
      configured: true,
      pointCount,
    };
  } catch (error: any) {
    logger.error('Failed to check index status', error);
    return {
      indexed: false,
      configured: false,
      message: error.message,
    };
  }
}

// Get all indexable files in workspace
function getIndexableFiles(
  dirPath: string,
  basePath: string = dirPath,
): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
          files.push(...getIndexableFiles(fullPath, basePath));
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
  } catch (error) {
    logger.warn(`Failed to read directory: ${dirPath}`);
  }

  return files;
}

// Parse code into chunks
function parseCodeIntoChunks(content: string, filePath: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = content.split('\n');
  const ext = path.extname(filePath).toLowerCase();

  // Simple chunking by detecting functions/classes
  // This is a simplified version - production would use proper AST parsing

  const functionPatterns = [
    // JavaScript/TypeScript
    /^(export\s+)?(async\s+)?function\s+(\w+)/,
    /^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(/,
    /^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?function/,
    // Python
    /^def\s+(\w+)\s*\(/,
    /^async\s+def\s+(\w+)\s*\(/,
    // Go
    /^func\s+(\w+)\s*\(/,
    /^func\s+\(\w+\s+\*?\w+\)\s+(\w+)\s*\(/,
    // Rust
    /^(pub\s+)?(async\s+)?fn\s+(\w+)/,
    // Java/C#
    /^(public|private|protected)?\s*(static\s+)?\w+\s+(\w+)\s*\(/,
  ];

  const classPatterns = [
    // JavaScript/TypeScript
    /^(export\s+)?(abstract\s+)?class\s+(\w+)/,
    /^(export\s+)?interface\s+(\w+)/,
    /^(export\s+)?type\s+(\w+)/,
    // Python
    /^class\s+(\w+)/,
    // Go struct
    /^type\s+(\w+)\s+struct/,
    // Rust
    /^(pub\s+)?struct\s+(\w+)/,
    /^(pub\s+)?enum\s+(\w+)/,
    /^(pub\s+)?trait\s+(\w+)/,
  ];

  let currentChunk: CodeChunk | null = null;
  let braceCount = 0;
  let indentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines and comments for detection
    if (
      !trimmedLine ||
      trimmedLine.startsWith('//') ||
      trimmedLine.startsWith('#') ||
      trimmedLine.startsWith('/*')
    ) {
      if (currentChunk) {
        currentChunk.content += line + '\n';
      }
      continue;
    }

    // Check for function/class start
    let isStart = false;
    let name = '';
    let chunkType: 'function' | 'class' | 'module' | 'other' = 'other';

    for (const pattern of classPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        isStart = true;
        name = match[match.length - 1] || match[1] || '';
        chunkType = 'class';
        break;
      }
    }

    if (!isStart) {
      for (const pattern of functionPatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          isStart = true;
          name = match[match.length - 1] || match[1] || '';
          chunkType = 'function';
          break;
        }
      }
    }

    if (isStart && braceCount === 0) {
      // Save previous chunk
      if (currentChunk && currentChunk.content.trim()) {
        currentChunk.endLine = i;
        chunks.push(currentChunk);
      }

      // Start new chunk
      currentChunk = {
        content: line + '\n',
        filePath,
        startLine: i + 1,
        endLine: i + 1,
        chunkType,
        name,
      };
      indentLevel = line.length - line.trimStart().length;
    } else if (currentChunk) {
      currentChunk.content += line + '\n';
    }

    // Track brace depth for languages that use braces
    if (
      [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.java',
        '.go',
        '.rs',
        '.c',
        '.cpp',
        '.cs',
        '.kt',
        '.scala',
      ].includes(ext)
    ) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (braceCount <= 0 && currentChunk) {
        currentChunk.endLine = i + 1;
        chunks.push(currentChunk);
        currentChunk = null;
        braceCount = 0;
      }
    }
    // For Python, use indentation
    else if (['.py'].includes(ext)) {
      const currentIndent = line.length - line.trimStart().length;
      if (
        currentChunk &&
        trimmedLine &&
        currentIndent <= indentLevel &&
        i > currentChunk.startLine
      ) {
        currentChunk.endLine = i;
        chunks.push(currentChunk);
        currentChunk = null;
      }
    }
  }

  // Push remaining chunk
  if (currentChunk && currentChunk.content.trim()) {
    currentChunk.endLine = lines.length;
    chunks.push(currentChunk);
  }

  // If no chunks were found, create one chunk for the whole file
  if (chunks.length === 0 && content.trim()) {
    chunks.push({
      content: content,
      filePath,
      startLine: 1,
      endLine: lines.length,
      chunkType: 'module',
      name: path.basename(filePath),
    });
  }

  // Merge very small chunks and split very large ones
  const processedChunks: CodeChunk[] = [];
  const MAX_CHUNK_CHARS = 2000;
  const MIN_CHUNK_CHARS = 100;

  for (const chunk of chunks) {
    if (chunk.content.length > MAX_CHUNK_CHARS) {
      // Split large chunk
      const splitChunks = splitLargeChunk(chunk, MAX_CHUNK_CHARS);
      processedChunks.push(...splitChunks);
    } else if (
      chunk.content.length < MIN_CHUNK_CHARS &&
      processedChunks.length > 0
    ) {
      // Merge with previous chunk if too small
      const lastChunk = processedChunks[processedChunks.length - 1];
      if (lastChunk.filePath === chunk.filePath) {
        lastChunk.content += '\n' + chunk.content;
        lastChunk.endLine = chunk.endLine;
      } else {
        processedChunks.push(chunk);
      }
    } else {
      processedChunks.push(chunk);
    }
  }

  return processedChunks;
}

// Split a large chunk into smaller ones
function splitLargeChunk(chunk: CodeChunk, maxChars: number): CodeChunk[] {
  const result: CodeChunk[] = [];
  const lines = chunk.content.split('\n');
  let currentContent = '';
  let currentStartLine = chunk.startLine;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      currentContent.length + line.length > maxChars &&
      currentContent.length > 0
    ) {
      result.push({
        ...chunk,
        content: currentContent,
        startLine: currentStartLine,
        endLine: chunk.startLine + i - 1,
      });
      currentContent = line + '\n';
      currentStartLine = chunk.startLine + i;
    } else {
      currentContent += line + '\n';
    }
  }

  if (currentContent.trim()) {
    result.push({
      ...chunk,
      content: currentContent,
      startLine: currentStartLine,
      endLine: chunk.endLine,
    });
  }

  return result;
}

// Clean code content - remove excessive comments but keep structure
function cleanCodeContent(content: string): string {
  // Remove block comments
  let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove consecutive empty lines (keep max 1)
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Remove trailing whitespace from lines
  cleaned = cleaned
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');

  return cleaned.trim();
}

// Get embedding from Gemini
async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: {
          parts: [{ text }],
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini embedding error: ${response.status} - ${errorText}`,
    );
  }

  const data = await response.json();
  return data.embedding?.values || [];
}

// Create or recreate collection in Qdrant
async function createCollection(
  collectionName: string,
  qdrantEndpoint: string,
  qdrantApiKey: string,
  vectorSize: number = 3072, // gemini-embedding-001 has 3072 dimensions
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (qdrantApiKey) {
    headers['api-key'] = qdrantApiKey;
  }

  // Delete existing collection if exists
  try {
    await fetch(`${qdrantEndpoint}/collections/${collectionName}`, {
      method: 'DELETE',
      headers,
    });
  } catch {
    // Ignore deletion errors
  }

  // Create new collection
  const response = await fetch(
    `${qdrantEndpoint}/collections/${collectionName}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to create collection: ${response.status}`);
  }
}

// Upsert points to Qdrant
async function upsertPoints(
  collectionName: string,
  points: Array<{ id: number; vector: number[]; payload: any }>,
  qdrantEndpoint: string,
  qdrantApiKey: string,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (qdrantApiKey) {
    headers['api-key'] = qdrantApiKey;
  }

  const response = await fetch(
    `${qdrantEndpoint}/collections/${collectionName}/points`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ points }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to upsert points: ${response.status}`);
  }
}

// Main indexing function
export async function indexCodebase(params: IndexingParams): Promise<void> {
  const { workspacePath, qdrantEndpoint, qdrantApiKey, geminiApiKeys } = params;

  logger.info(`Starting indexing for: ${workspacePath}`);

  // Get all indexable files
  const files = getIndexableFiles(workspacePath);
  logger.info(`Found ${files.length} files to index`);

  if (files.length === 0) {
    logger.warn('No indexable files found');
    return;
  }

  // Parse all files into chunks
  const allChunks: CodeChunk[] = [];
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const cleanedContent = cleanCodeContent(content);
      const chunks = parseCodeIntoChunks(cleanedContent, filePath);
      allChunks.push(...chunks);
    } catch (error) {
      logger.warn(`Failed to process file: ${filePath}`);
    }
  }

  logger.info(`Created ${allChunks.length} chunks`);

  if (allChunks.length === 0) {
    logger.warn('No chunks created');
    return;
  }

  // Create collection
  const collectionName = getCollectionName(workspacePath);
  await createCollection(collectionName, qdrantEndpoint, qdrantApiKey);
  logger.info(`Created collection: ${collectionName}`);

  // Generate embeddings and upsert in batches
  const BATCH_SIZE = 10;
  const keyManager = new ApiKeyManager(geminiApiKeys);

  logger.info('Warming up API keys...');
  await keyManager.warmup();

  if (!keyManager.hasActiveKeys()) {
    logger.error('No active API keys available after warmup');
    throw new Error('All API keys failed to warmup');
  }

  const points: Array<{ id: number; vector: number[]; payload: any }> = [];

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];

    let success = false;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    while (!success && retryCount < MAX_RETRIES) {
      const apiKey = keyManager.getNextKey();
      if (!apiKey) {
        logger.warn('No available API keys, waiting 5 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        retryCount++;
        continue;
      }

      try {
        const relativePath = path.relative(workspacePath, chunk.filePath);
        const embeddingText = `File: ${relativePath}\n${chunk.name ? `Name: ${chunk.name}\n` : ''}${chunk.content}`;

        const vector = await getEmbedding(embeddingText, apiKey);

        points.push({
          id: i + 1,
          vector,
          payload: {
            file_path: relativePath,
            full_path: chunk.filePath,
            start_line: chunk.startLine,
            end_line: chunk.endLine,
            chunk_type: chunk.chunkType,
            name: chunk.name,
            content: chunk.content.slice(0, 1000),
          },
        });

        if (points.length >= BATCH_SIZE) {
          await upsertPoints(
            collectionName,
            points,
            qdrantEndpoint,
            qdrantApiKey,
          );
          logger.info(`Indexed ${i + 1}/${allChunks.length} chunks`);
          points.length = 0;
        }

        success = true;
      } catch (error: any) {
        const isRateLimit = error.message.includes('429');
        keyManager.markError(apiKey, isRateLimit);

        if (isRateLimit) {
          logger.warn(
            `Rate limit hit for chunk ${i}, retrying with another key...`,
          );
          // Don't increment retryCount for rate limits if we have other keys
          if (keyManager.hasActiveKeys()) {
            continue;
          }
        }

        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          logger.error(
            `Failed to embed chunk ${i} after ${MAX_RETRIES} retries: ${error.message}`,
          );
        } else {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retryCount) * 1000),
          );
        }
      }
    }

    // Optional: Small delay between successful embeddings to be safe
    // await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Upsert remaining points
  if (points.length > 0) {
    await upsertPoints(collectionName, points, qdrantEndpoint, qdrantApiKey);
  }

  logger.info(`Indexing complete for: ${workspacePath}`);
}

// Search for relevant files
export async function searchRelevantFiles(params: SearchParams): Promise<{
  files: Array<{
    path: string;
    startLine: number;
    endLine: number;
    snippet: string;
    score: number;
  }>;
}> {
  const {
    workspacePath,
    query,
    limit,
    qdrantEndpoint,
    qdrantApiKey,
    geminiApiKeys,
  } = params;

  const collectionName = getCollectionName(workspacePath);

  // Get query embedding
  const queryVector = await getEmbedding(query, geminiApiKeys[0]);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (qdrantApiKey) {
    headers['api-key'] = qdrantApiKey;
  }

  // Search in Qdrant
  const response = await fetch(
    `${qdrantEndpoint}/collections/${collectionName}/points/search`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vector: queryVector,
        limit,
        with_payload: true,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Qdrant search error: ${response.status}`);
  }

  const data = await response.json();
  const results = data.result || [];

  return {
    files: results.map((result: any) => ({
      path: result.payload?.file_path || '',
      startLine: result.payload?.start_line || 0,
      endLine: result.payload?.end_line || 0,
      snippet: result.payload?.content || '',
      score: result.score || 0,
    })),
  };
}
