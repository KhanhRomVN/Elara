import { Account } from '../ipc/accounts';

export const getCookies = (account: Account) => {
  if (!account.credential) return [];
  try {
    return JSON.parse(account.credential);
  } catch (error) {
    return account.credential.split(';').map((c) => {
      const parts = c.trim().split('=');
      const name = parts[0];
      const value = parts.slice(1).join('=');
      return { name, value };
    });
  }
};

export const getCookieValue = (cookies: any[], name: string) => {
  const cookie = cookies.find((c: any) => c.name === name);
  return cookie ? cookie.value : '';
};
