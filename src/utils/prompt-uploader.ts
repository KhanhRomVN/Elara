import * as path from 'path';
import { createLogger } from './logger';
import { Message } from '../types';

const logger = createLogger('PromptUploader');

/**
 * Provider-specific configuration for automatic large payload uploading.
 * Only providers set to `true` will auto-upload large non-system payloads (> 100KB) as virtual text files.
 */
export const AUTO_UPLOAD_PROVIDERS: Record<string, boolean> = {
  deepseek: true, // Only DeepSeek is enabled
  kimi: false,
  qwen: false,
  zai: false,
  mistral: false,
  groq: false,
  claude: false,
  openai: false,
};

/**
 * Default character threshold for non-system payloads to be uploaded as virtual files (100KB).
 */
export const DEFAULT_MAX_INLINE_PAYLOAD_CHARS = 100000;

/**
 * Checks if a given message is a System Prompt or system instructions.
 * System Prompts must ALWAYS be preserved as pure text and never uploaded as files.
 */
export function isSystemPromptMessage(msg: Message | any): boolean {
  if (!msg) return false;
  if (msg.role === 'system') return true;
  const text = (typeof msg.content === 'string' ? msg.content : '').trim();
  return (
    text.startsWith('You are ') ||
    text.startsWith('You are an ') ||
    text.startsWith('# Instructions') ||
    text.startsWith('SYSTEM:') ||
    text.startsWith('<system>') ||
    text.startsWith('[SYSTEM') ||
    text.includes('You have access to the following tools') ||
    text.includes('<tools>') ||
    text.includes('You are a helpful assistant')
  );
}

/**
 * Checks if auto-upload is enabled for a given provider.
 */
export function isAutoUploadEnabled(providerId: string): boolean {
  const key = (providerId || '').toLowerCase();
  return Boolean(AUTO_UPLOAD_PROVIDERS[key]);
}

/**
 * Extracts a meaningful filename from tool results or message content.
 */
export function extractAttachmentFileName(promptText: string): string {
  // Check if text matches common tool path patterns (e.g. read_file for 'xxx.js')
  const fileMatch = promptText.match(
    /(?:file_path|path|for|reading)\s*[:=]?\s*['"`]?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)['"`]?/i,
  );
  if (fileMatch && fileMatch[1]) {
    return path.basename(fileMatch[1].replace(/\\/g, '/'));
  }

  // Fallback to first line snippet or generic name
  let snippet = promptText
    .trim()
    .split('\n')[0]
    .slice(0, 30)
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
  if (snippet && snippet.length >= 3) {
    return `${snippet}.txt`;
  }
  return 'attached_content.txt';
}

export interface ExtractedAttachment {
  fileName: string;
  content: string;
}

/**
 * Splits multi-file tool outputs into individual files (e.g. when agent reads multiple files concurrently).
 */
export function splitLargePayloadFiles(promptText: string): ExtractedAttachment[] {
  const files: ExtractedAttachment[] = [];

  // Regex to match tool headers like:
  // [read_file for 'path/to/file.js'] Result:
  // [read_file: path/to/file.js] Result:
  // <tool_result ... file_path="path/to/file.js">
  const headerRegex =
    /(?:\[(?:read_file|read|reading_file|view_file|tool_result)[^\]\n]*?['"`]?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)['"`]?[^\]\n]*?\]\s*(?:Result:?)?|<(?:tool_result|file)[^>]*?(?:file_path|path|name)=["']([^"']+)["'][^>]*>)/gi;

  const matches = [...promptText.matchAll(headerRegex)];

  if (matches.length > 1) {
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const rawPath = match[1] || match[2] || 'attachment.txt';
      const fileName = path.basename(rawPath.replace(/\\/g, '/'));
      const startIdx = match.index! + match[0].length;
      const endIdx =
        i + 1 < matches.length ? matches[i + 1].index! : promptText.length;

      let chunk = promptText.slice(startIdx, endIdx).trim();
      chunk = chunk.replace(/<\/(?:tool_result|file)>\s*$/i, '').trim();

      if (chunk.length > 0) {
        files.push({
          fileName,
          content: chunk,
        });
      }
    }
    if (files.length > 0) {
      return files;
    }
  }

  // Fallback to single file if no multi-block pattern detected
  return [
    {
      fileName: extractAttachmentFileName(promptText),
      content: promptText,
    },
  ];
}

export interface PreparePromptOptions {
  providerId: string;
  messages: Message[];
  refFileIds?: string[];
  uploadFn?: (file: any) => Promise<{ id: string; token_usage?: number }>;
  maxChars?: number;
}

export interface PreparedPromptResult {
  promptText: string;
  refFileIds: string[];
}

/**
 * Common handler to process large text payloads across all providers.
 * System prompts are ALWAYS kept as raw text.
 * Only enabled providers (currently DeepSeek = true) will upload non-system payloads > 100KB as attached files.
 */
export async function preparePromptAndAttachments(
  options: PreparePromptOptions,
): Promise<PreparedPromptResult> {
  const { providerId, messages, uploadFn } = options;
  const maxChars = options.maxChars || DEFAULT_MAX_INLINE_PAYLOAD_CHARS;
  const refFileIds: string[] = [...(options.refFileIds || [])];

  const lastMsg =
    messages && messages.length > 0 ? messages[messages.length - 1] : null;
  let promptText =
    typeof lastMsg?.content === 'string'
      ? lastMsg.content
      : JSON.stringify(lastMsg?.content || '');

  // 1. Check if auto-upload is enabled for this provider
  if (!isAutoUploadEnabled(providerId)) {
    return { promptText, refFileIds };
  }

  // 2. System Prompts must NEVER be uploaded as files (always sent as pure text)
  const isSystem =
    isSystemPromptMessage(lastMsg) ||
    (messages.length === 1 && isSystemPromptMessage(messages[0]));

  if (isSystem) {
    return { promptText, refFileIds };
  }

  // 3. Check if payload exceeds threshold and upload function is provided
  if (promptText.length > maxChars && typeof uploadFn === 'function') {
    logger.info(
      `[${providerId}] Large non-system payload (${promptText.length} chars) exceeds threshold (${maxChars}). Auto-uploading...`,
    );

    try {
      const extractedFiles = splitLargePayloadFiles(promptText);
      logger.info(
        `[${providerId}] Split payload into ${extractedFiles.length} separate file(s): ${extractedFiles.map((f) => f.fileName).join(', ')}`,
      );

      // Upload all extracted files in parallel
      const uploadPromises = extractedFiles.map(async (fileItem) => {
        const fileObj = {
          originalname: fileItem.fileName,
          mimetype: 'text/plain',
          buffer: Buffer.from(fileItem.content, 'utf-8'),
        };
        const res = await uploadFn(fileObj);
        return { ...res, fileName: fileItem.fileName };
      });

      const uploadResults = await Promise.all(uploadPromises);
      const successfulUploads = uploadResults.filter((r) => r && r.id);

      if (successfulUploads.length > 0) {
        for (const up of successfulUploads) {
          refFileIds.push(up.id);
        }
        const fileNamesList = successfulUploads
          .map((u) => u.fileName)
          .join(', ');
        logger.info(
          `[${providerId}] Auto-uploaded ${successfulUploads.length} file(s) successfully: ${fileNamesList}. IDs: ${successfulUploads.map((u) => u.id).join(', ')}`,
        );

        // Preserve full file paths and tool call wrappers in promptText while stripping the massive file bodies
        let modifiedPrompt = promptText;
        for (const up of successfulUploads) {
          const matching = extractedFiles.find((f) => f.fileName === up.fileName);
          if (matching && matching.content.length > 50000 && modifiedPrompt.includes(matching.content)) {
            modifiedPrompt = modifiedPrompt.replace(
              matching.content,
              `[Nội dung tệp ${up.fileName} đã được tự động đính kèm vào phiên chat]`,
            );
          }
        }

        if (modifiedPrompt.length > maxChars) {
          if (successfulUploads.length === 1) {
            promptText = `[Đã đính kèm tệp ${successfulUploads[0].fileName}]: Vui lòng phân tích và xử lý nội dung trong tệp đính kèm.`;
          } else {
            promptText = `[Đã đính kèm các tệp: ${fileNamesList}]: Vui lòng phân tích và xử lý nội dung trong các tệp đính kèm.`;
          }
        } else {
          promptText = modifiedPrompt;
        }
      }
    } catch (uploadErr: any) {
      logger.warn(
        `[${providerId}] Auto-upload failed, falling back to direct prompt: ${uploadErr.message}`,
      );
    }
  }

  return { promptText, refFileIds };
}
