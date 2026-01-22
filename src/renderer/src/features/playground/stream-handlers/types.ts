import { Message } from '../types';

export interface StreamLineHandler {
  processLine: (
    line: string,
    currentMessageId: string,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    onTokenUpdate?: (tokens: number) => void,
    onSessionId?: (sessionId: string) => void,
    onTitleUpdate?: (title: string) => void,
  ) => void;
}
