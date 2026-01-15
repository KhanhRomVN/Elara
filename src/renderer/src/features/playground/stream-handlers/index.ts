import { Provider } from '../types/index';
import { defaultHandler } from './default';
import { deepseekHandler } from './deepseek';
import { StreamLineHandler } from './types';

export const getStreamHandler = (provider: Provider): StreamLineHandler => {
  switch (provider) {
    case 'DeepSeek':
      return deepseekHandler;
    default:
      return defaultHandler;
  }
};
