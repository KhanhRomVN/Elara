import { loginWithRealBrowser } from '../../browser-login';
import { proxyEvents } from '../../proxy-events';

export async function login() {
  let capturedMetadata: any = {};
  let capturedEmail = '';

  const onMetadata = (metadata: any) => {
    capturedMetadata = { ...capturedMetadata, ...metadata };
  };

  const onUserInfo = (data: any) => {
    if (data && data.email) capturedEmail = data.email;
  };

  proxyEvents.on('gemini-metadata', onMetadata);
  proxyEvents.on('gemini-user-info', onUserInfo);

  try {
    return await loginWithRealBrowser({
      providerId: 'Gemini',
      loginUrl: 'https://gemini.google.com',
      partition: `gemini-${Date.now()}`,
      cookieEvent: 'gemini-cookies',
      validate: async (data: any) => {
        // Gemini needs cookies AND specific metadata
        if (data.cookies && capturedMetadata.snlm0e && capturedMetadata.bl) {
          return {
            isValid: true,
            cookies: JSON.stringify({
              cookies: data.cookies,
              metadata: capturedMetadata,
            }),
            email: capturedEmail || data.email || 'gemini@user.com',
          };
        }
        return { isValid: false };
      },
    });
  } finally {
    proxyEvents.off('gemini-metadata', onMetadata);
    proxyEvents.off('gemini-user-info', onUserInfo);
  }
}
