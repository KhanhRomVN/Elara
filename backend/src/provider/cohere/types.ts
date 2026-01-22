export interface CohereMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CohereChatRequest {
  model: string;
  messages: CohereMessage[];
  stream?: boolean;
}

export interface CohereDelta {
  message?: {
    content?: {
      text?: string;
    };
  };
}

export interface CohereStreamEvent {
  type: string;
  delta?: CohereDelta;
}
