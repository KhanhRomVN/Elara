export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

export function getCookieValue(cookies: any[], name: string) {
  const cookie = cookies.find((c: any) => c.name === name);
  return cookie ? cookie.value : '';
}

import { loginWithRealBrowser } from '../../browser-login';

export async function login() {
  return loginWithRealBrowser({
    providerId: 'Groq',
    loginUrl: 'https://console.groq.com/login',
    partition: `groq-${Date.now()}`,
    cookieEvent: 'groq-cookies',
    validate: async (data: any) => {
      if (!data.cookies) return { isValid: false };

      let email = 'groq@user.com';
      try {
        const cookieList = data.cookies.split(';').map((c: string) => {
          const parts = c.trim().split('=');
          return { name: parts[0], value: parts.slice(1).join('=') };
        });
        const sessionJwt = cookieList.find((c: any) => c.name === 'stytch_session_jwt')?.value;
        if (sessionJwt) {
          const base64Url = sessionJwt.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
              })
              .join(''),
          );
          const payload = JSON.parse(jsonPayload);
          const stytchSession = payload['https://stytch.com/session'];
          if (stytchSession?.authentication_factors?.[0]?.email_factor?.email_address) {
            email = stytchSession.authentication_factors[0].email_factor.email_address;
          }
        }
      } catch (e) {}

      return { isValid: true, cookies: data.cookies, email };
    },
  });
}
