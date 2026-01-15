import { Message } from '../types';

export interface StreamLineHandler {
  processLine: (
    line: string,
    currentMessageId: string,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    onTokenUpdate?: (tokens: number) => void,
  ) => void;
}
