import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import fetch from 'node-fetch';
import * as https from 'https';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LMArenaProvider');

export class LMArenaProvider implements Provider {
  name = 'LMArena';
  defaultModel = 'gpt-4o'; // Placeholder

  async handleMessage(options: SendMessageOptions): Promise<void> {
    // Basic implementation placeholder - migrated from chat.service which threw error
    throw new Error('LMArena send message not implemented yet');
  }

  async getConversations(
    credential: string, // Actually accepts full Account object in other places but here signature is string
    // logic in chat.service uses makeHttpsRequest with cookie
    limit: number = 50, // This signature matches generic interface but limit is 2nd arg
  ): Promise<any[]> {
    try {
      // Note: chat.service had `getLMArenaConversations(credential, limit)`
      // The interface might differ slightly, we need to adapt.
      const response: any = await this.makeHttpsRequest(
        `https://lmarena.ai/api/history/list?limit=${limit}`,
        {
          method: 'GET',
          headers: {
            Cookie: credential,
            Accept: 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        },
      );

      return response?.history || [];
    } catch (error) {
      logger.error('Error fetching LMArena conversations', error);
      throw error;
    }
  }

  // Overload to support Account object if needed, but for now matching chat.service

  private makeHttpsRequest(
    url: string,
    options: https.RequestOptions,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve(data);
            }
          } else {
            reject(
              new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage}`),
            );
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  registerRoutes(router: Router) {}

  isModelSupported(model: string): boolean {
    return false; // dynamic list
  }
}
