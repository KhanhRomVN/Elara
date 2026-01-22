import { Provider } from '../types/index';
import { defaultHandler } from './default';
import { StreamLineHandler } from './types';

export const getStreamHandler = (_provider: Provider): StreamLineHandler => {
  return defaultHandler;
};
