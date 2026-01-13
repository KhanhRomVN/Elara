import { Account } from '../ipc/accounts';

export const getCookies = (account: Account) => {
  return account.credential ? JSON.parse(account.credential) : [];
};

export const getCookieValue = (cookies: any[], name: string) => {
  const cookie = cookies.find((c: any) => c.name === name);
  return cookie ? cookie.value : '';
};
