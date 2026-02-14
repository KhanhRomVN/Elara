export * from './api';
export * from './chat';

import { loginWithRealBrowser } from '../../browser-login';

export const login = async (options?: any) => {
  return loginWithRealBrowser({
    providerId: 'claude',
    loginUrl: 'https://claude.ai/login',
    cookieEvent: 'claude-cookies',
    partition: 'persist:claude',
  });
};
