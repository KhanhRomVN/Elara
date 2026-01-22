export interface GeminiConfig {
  model?: string;
  stream?: boolean;
}

export interface GeminiContext {
  sid: string;
  bl: string;
  at: string;
  cfb2h?: string;
  wizId?: string;
}
