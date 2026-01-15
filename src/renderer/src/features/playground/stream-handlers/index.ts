import { Provider } from '../types/index';
import { defaultHandler } from './default';
import { deepseekHandler } from './deepseek';
import { huggingChatHandler } from './hugging-chat';
import { StreamLineHandler } from './types';
import { lmArenaHandler } from './lmarena';

export const getStreamHandler = (provider: Provider): StreamLineHandler => {
  switch (provider) {
    case 'DeepSeek':
      return deepseekHandler;
    case 'HuggingChat':
      return huggingChatHandler;
    case 'LMArena':
      return lmArenaHandler;
    default:
      return defaultHandler;
  }
};
