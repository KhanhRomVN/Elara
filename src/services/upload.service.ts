/**
 * ------------------------------------------------------------------
 * Upload Service
 * ------------------------------------------------------------------
 * Business logic upload file lên provider AI.
 *
 * Main functions:
 * - uploadFileToProvider() : Upload file qua provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Providers ──
import { providerRegistry } from '../provider/registry';

// ─── Interfaces ─────────────────────────────────────────────────────────
export interface UploadResult {
  file_id?: string;
  token_usage?: number;
  raw?: any;
}

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Upload file qua provider
 */
export async function uploadFileToProvider(
  providerId: string,
  credential: string,
  file: Express.Multer.File,
): Promise<UploadResult> {
  const provider = providerRegistry.getProvider(providerId);

  if (!provider) {
    throw new Error(`Provider ${providerId} not supported`);
  }

  if (!provider.uploadFile) {
    throw new Error(`Provider ${providerId} does not support file upload`);
  }

  const result = await provider.uploadFile(credential, file);

  // Normalize result format
  if (typeof result === 'string') {
    return { file_id: result };
  } else if (result && typeof result === 'object' && 'id' in result) {
    return {
      file_id: result.id,
      token_usage: (result as any).token_usage,
    };
  } else {
    return { raw: result };
  }
}