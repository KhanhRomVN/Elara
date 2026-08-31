/**
 * ------------------------------------------------------------------
 * DeepSeek File Upload
 * ------------------------------------------------------------------
 * Upload file lên DeepSeek API. Hỗ trợ giải PoW challenge,
 * multipart/form-data upload, và polling để chờ file được xử lý.
 *
 * Main functions:
 * - deepseekUploadFile() : Upload file và trả về file_id + token_usage
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// ── Utils ──
import { HttpClient } from '../../utils/http-client';
import { createLogger } from '../../utils/logger';

// ── DeepSeek Imports ──
import { DeepSeekHash, BASE_URL, solvePoW } from './deepseek.pow';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('DeepSeekUpload');

// ─── Helpers ────────────────────────────────────────────────────────────

function createUploadClient(credential: string): HttpClient {
  return new HttpClient({
    baseURL: 'https://chat.deepseek.com',
    headers: {
      Cookie: `DS-AUTH-TOKEN=${credential}`,
      Authorization: credential,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
}

// ─── Main Function ─────────────────────────────────────────────────────

export async function deepseekUploadFile(
  credential: string,
  file: any,
  getDsHash: () => Promise<DeepSeekHash>,
): Promise<{ id: string; token_usage: number }> {
  const baseHeaders = {
    Cookie: `DS-AUTH-TOKEN=${credential}`,
    Authorization: credential,
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    Origin: 'https://chat.deepseek.com',
    Referer: 'https://chat.deepseek.com/',
  };

  const client = createUploadClient(credential);

  try {
    const challengeRes = await client.post(
      '/api/v0/chat/create_pow_challenge',
      { target_path: '/api/v0/file/upload_file' },
    );

    let powResponseBase64 = '';
    if (challengeRes.ok) {
      try {
        const challengeJson = await challengeRes.json();
        const challengeData = challengeJson?.data?.biz_data?.challenge;

        if (challengeData) {
          logger.info('[DeepSeek Upload] Solving PoW...');
          const dsHash = await getDsHash();
          const powAnswer = await solvePoW(dsHash, challengeData);
          powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString(
            'base64',
          );
        }
      } catch (e) {
        logger.error(
          '[DeepSeek Upload] Failed to parse PoW challenge response',
          {
            error: e,
          }
        );
      }
    }

    const boundary =
      '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
    const crlf = '\r\n';
    const header = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${file.originalname}"${crlf}Content-Type: ${file.mimetype}${crlf}${crlf}`;
    const footer = `${crlf}--${boundary}--${crlf}`;
    const payloadBuffer = Buffer.concat([
      Buffer.from(header),
      file.buffer,
      Buffer.from(footer),
    ]);

    const headers: any = {
      ...baseHeaders,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'x-client-locale': 'en_US',
      'x-app-version': '20241129.1',
      'x-client-version': '1.6.1',
      'x-client-platform': 'web',
      'x-file-size': file.buffer.length.toString(),
    };

    if (powResponseBase64) {
      headers['X-Ds-Pow-Response'] = powResponseBase64;
    }

    const uploadRes = await fetch(
      'https://chat.deepseek.com/api/v0/file/upload_file',
      {
        method: 'POST',
        headers,
        body: payloadBuffer,
      },
    );

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      throw new Error(
        `DeepSeek Upload Failed ${uploadRes.status}: ${errorText}`,
      );
    }

    const result: any = await uploadRes.json();
    if (result.code === 0 && result.data?.biz_data?.id) {
      const fileId = result.data.biz_data.id;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          const listRes = await client.get(
            `/api/v0/file/fetch_files?file_ids=${fileId}`,
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            const files = listData?.data?.biz_data?.files || [];
            const targetFile = files.find((f: any) => f.id === fileId);

            if (targetFile) {
              if (
                targetFile.status === 'SUCCESS' ||
                targetFile.status === 'READY'
              ) {
                return {
                  id: fileId,
                  token_usage: targetFile.token_usage || 0,
                };
              }
              if (
                targetFile.status === 'FAIL' ||
                targetFile.status === 'ERROR'
              ) {
                throw new Error(
                  `File processing failed: ${targetFile.status}`,
                );
              }
            }
          }
        } catch (e) {
          logger.error(
            `[DeepSeek Upload] Failed to check file status | fileId=${fileId} | attempt=${attempts + 1}`,
            {
              error: e,
              fileId,
              attempt: attempts + 1,
            }
          );
        }
        attempts++;
      }
      return { id: fileId, token_usage: 0 };
    } else {
      throw new Error(`Upload failed: ${result.msg || 'Unknown error'}`);
    }
  } catch (error) {
    logger.error('[DeepSeek Upload] Error:', error);
    throw error;
  }
}