export interface PoWChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  difficulty: number;
  signature: string;
  expire_at: number;
  target_path: string;
}

export interface PoWResponse {
  algorithm: string;
  challenge: string;
  salt: string;
  answer: number;
  signature: string;
  target_path: string;
}

export interface ChatPayload {
  model?: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  search?: boolean;
  conversation_id?: string;
  ref_file_ids?: string[];
  thinking?: boolean;
  parent_message_id?: string;
  client_stream_id?: string;
  chat_session_id?: string;
  prompt?: string;
  thinking_enabled?: boolean;
  search_enabled?: boolean;
}
