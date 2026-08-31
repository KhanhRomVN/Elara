import { Router } from 'express';
import { Message } from './message.types';

export interface SendMessageOptions {
  credential: string;
  provider_id: string;
  accountId?: string;
  model: string;
  messages: Message[];
  conversationId?: string;
  parent_message_id?: string;
  search?: boolean;
  ref_file_ids?: string[];
  thinking?: boolean;
  stream?: boolean;
  temperature?: number;
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: any) => void;
  onDone: () => void;
  onError: (err: any) => void;
  onRaw?: (data: string) => void;
  onSessionCreated?: (sessionId: string) => void;
}

export interface Provider {
  name: string;
  handleMessage(options: SendMessageOptions): Promise<void>;
  registerRoutes?(router: Router): void;
  uploadFile?(credential: string, file: any): Promise<any>;
  getModels?(credential: string, accountId?: string): Promise<any[]>;
  isModelSupported?(model: string): boolean;
  defaultModel?: string;
  login?(options?: any): Promise<any>;
  getProfile?(credential: string): Promise<{ email: string | null; name?: string; id?: string }>;
  refreshToken?(refreshToken: string): Promise<any>;
  getUsage?(credential: string): Promise<{ usage: string; resetPeriod: 'day' | 'month' | string }>;
  proxyHandler?: any;
}

export interface ProxyConfig {
  host: string;
  port: number;
  enabled: boolean;
}

export interface ProxyHandler {
  onRequest?: (ctx: any, callback: () => void) => void;
  onRequestData?: (ctx: any, chunk: Buffer, callback: (err: Error | null, data?: Buffer) => void) => void;
  onResponseBody?: (ctx: any, body: string) => void;
}