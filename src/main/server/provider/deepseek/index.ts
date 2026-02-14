export * from './types';
export * from './chat';
export * from './pov';
export * from './parser';
export * from './api';

import { loginWithRealBrowser } from '../../browser-login';

export const login = async (options?: any) => {
  return loginWithRealBrowser({
    providerId: 'deepseek',
    loginUrl: 'https://chat.deepseek.com/sign_in',
    cookieEvent: 'deepseek-login-token',
    partition: 'persist:deepseek',
  });
};
