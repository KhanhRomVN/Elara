import type { Account } from '@backend/types';
import express from 'express';
import { getDb } from '@backend/services/db';

export const getAccounts = (): Account[] => {
  try {
    const db = getDb();
    return db.prepare('SELECT * FROM accounts').all() as Account[];
  } catch (error) {
    console.error('[AccountUtils] Failed to get accounts from DB:', error);
    return [];
  }
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

  // 2. Try by Email + Provider (using provider_id)
  if (!account && emailQuery) {
    account = accounts.find(
      (a) =>
        a.email.toLowerCase() === emailQuery.toLowerCase() &&
        a.provider_id.toLowerCase() === provider.toLowerCase(),
    );
  }

  // 3. Try generic account for provider
  if (!account) {
    // Backend accounts don't have status, so we assume all valid accounts in DB are capable
    account = accounts.find((a) => a.provider_id.toLowerCase() === provider.toLowerCase());
  }

  return account;
};
