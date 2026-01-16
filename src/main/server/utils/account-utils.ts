import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Account } from '../../ipc/accounts';
import express from 'express';

const DATA_FILE = path.join(app.getPath('userData'), 'accounts.json');

export const getAccounts = (): Account[] => {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
};

export const findAccount = (
  req: express.Request,
  provider: string,
  email?: string,
): Account | undefined => {
  const accounts = getAccounts();
  const authHeader = req.headers.authorization;
  const emailQuery = email || (req.query.email as string);

  let account: Account | undefined;

  // 1. Try by Token (ID)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    account = accounts.find((a) => a.id === token);
  }

  // 2. Try by Email + Provider
  if (!account && emailQuery) {
    account = accounts.find(
      (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === provider,
    );
  }

  // 3. Try generic active account for provider
  if (!account) {
    account = accounts.find((a) => a.provider === provider && a.status === 'Active');
  }

  return account;
};
