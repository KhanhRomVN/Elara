import { Request, Response } from 'express';
import { getDb } from '../services/db';
import { createLogger } from '../utils/logger';

const logger = createLogger('AccountController');

interface Account {
  id: string;
  provider_id: string;
  email: string;
  credential: string;
}

export const importAccounts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const accounts: Account[] = req.body;

    if (!Array.isArray(accounts)) {
      res.status(400).json({
        success: false,
        message: 'Request body must be an array of accounts',
        error: {
          code: 'INVALID_INPUT',
          details: { expected: 'array', received: typeof req.body },
        },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (accounts.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No accounts to import',
        data: { imported: 0, skipped: 0, duplicates: [] },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const db = getDb();
    const duplicates: Account[] = [];
    const toInsert: Account[] = [];

    // Check for existing accounts
    const checkPromises = accounts.map((account) => {
      return new Promise<void>((resolve) => {
        db.get(
          'SELECT * FROM accounts WHERE email = ? AND provider_id = ?',
          [account.email, account.provider_id],
          (err: any, row: any) => {
            if (err) {
              logger.error('Error checking for duplicate', err);
              resolve();
            } else if (row) {
              duplicates.push(account);
              resolve();
            } else {
              toInsert.push(account);
              resolve();
            }
          },
        );
      });
    });

    await Promise.all(checkPromises);

    // Insert non-duplicate accounts
    if (toInsert.length > 0) {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmt = db.prepare(
          'INSERT INTO accounts (id, provider_id, email, credential) VALUES (?, ?, ?, ?)',
        );

        let errorOccurred = false;
        toInsert.forEach((account) => {
          if (errorOccurred) return;

          stmt.run(
            account.id,
            account.provider_id,
            account.email,
            account.credential,
            (err: any) => {
              if (err) {
                logger.error('Error inserting account', err);
                errorOccurred = true;
              }
            },
          );
        });

        stmt.finalize();

        if (errorOccurred) {
          db.run('ROLLBACK');
          res.status(500).json({
            success: false,
            message: 'Failed to import accounts',
            error: { code: 'DATABASE_ERROR' },
            meta: { timestamp: new Date().toISOString() },
          });
          return;
        } else {
          db.run('COMMIT', (err: any) => {
            if (err) {
              logger.error('Error committing transaction', err);
              res.status(500).json({
                success: false,
                message: 'Failed to commit transaction',
                error: { code: 'DATABASE_ERROR' },
                meta: { timestamp: new Date().toISOString() },
              });
              return;
            } else {
              res.status(200).json({
                success: true,
                message: `Successfully imported ${toInsert.length} account(s)`,
                data: {
                  imported: toInsert.length,
                  skipped: duplicates.length,
                  duplicates: duplicates.map((d) => ({
                    email: d.email,
                    provider_id: d.provider_id,
                  })),
                },
                meta: { timestamp: new Date().toISOString() },
              });
            }
          });
        }
      });
    } else {
      res.status(200).json({
        success: true,
        message: 'All accounts were duplicates',
        data: {
          imported: 0,
          skipped: duplicates.length,
          duplicates: duplicates.map((d) => ({
            email: d.email,
            provider_id: d.provider_id,
          })),
        },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }
  } catch (error) {
    logger.error('Error in importAccounts', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

export const addAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const account: Account = req.body;

    if (!account || typeof account !== 'object' || Array.isArray(account)) {
      res.status(400).json({
        success: false,
        message: 'Request body must be a single account object',
        error: {
          code: 'INVALID_INPUT',
          details: { expected: 'object', received: typeof req.body },
        },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (!account.provider_id || !account.email || !account.credential) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: provider_id, email, credential',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const db = getDb();

    // Check for existing account
    db.get(
      'SELECT * FROM accounts WHERE (email = ? AND provider_id = ?) OR id = ?',
      [account.email, account.provider_id, account.id],
      (err: any, row: any) => {
        if (err) {
          logger.error('Error checking for existing account', err);
          res.status(500).json({
            success: false,
            message: 'Database error',
            error: { code: 'DATABASE_ERROR' },
            meta: { timestamp: new Date().toISOString() },
          });
          return;
        }

        const id = row ? row.id : account.id || require('crypto').randomUUID();
        const action = row ? 'Update' : 'Create';

        if (row) {
          // Account already exists - Skip
          res.status(200).json({
            success: false,
            message: 'Account already exists',
            data: {
              id: row.id,
              email: row.email,
              provider_id: row.provider_id,
              action: 'skipped',
            },
            meta: { timestamp: new Date().toISOString() },
          });
          return;
        } else {
          // Create new
          db.run(
            'INSERT INTO accounts (id, provider_id, email, credential) VALUES (?, ?, ?, ?)',
            [id, account.provider_id, account.email, account.credential],
            (insertErr: any) => {
              if (insertErr) {
                logger.error('Error inserting account', insertErr);
                res.status(500).json({
                  success: false,
                  message: 'Failed to create account',
                  error: { code: 'DATABASE_ERROR' },
                });
                return;
              }
              res.status(201).json({
                success: true,
                message: 'Account created successfully',
                data: {
                  id,
                  email: account.email,
                  provider_id: account.provider_id,
                  action: 'created',
                },
                meta: { timestamp: new Date().toISOString() },
              });
            },
          );
        }
      },
    );
  } catch (error) {
    logger.error('Error in addAccount', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

export const getAccounts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const email = req.query.email as string;
    const provider_id = req.query.provider_id as string;
    const sort_by = (req.query.sort_by as string) || 'email';
    const order =
      (req.query.order as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const offset = (page - 1) * limit;

    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (email) {
      conditions.push('email LIKE ?');
      params.push(`%${email}%`);
    }

    if (provider_id) {
      conditions.push('provider_id = ?');
      params.push(provider_id);
    }

    let whereClause = '';
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM accounts ${whereClause}`;

    db.get(countSql, params, (err: any, row: any) => {
      if (err) {
        logger.error('Error counting accounts', err);
        res.status(500).json({
          success: false,
          message: 'Failed to count accounts',
          error: { code: 'DATABASE_ERROR' },
          meta: { timestamp: new Date().toISOString() },
        });
        return;
      }

      const total = row.total;

      // Data query
      const sql = `SELECT * FROM accounts ${whereClause} ORDER BY ${sort_by} ${order} LIMIT ? OFFSET ?`;
      const queryParams = [...params, limit, offset];

      db.all(sql, queryParams, (err: any, rows: any[]) => {
        if (err) {
          logger.error('Error fetching accounts', err);
          res.status(500).json({
            success: false,
            message: 'Failed to fetch accounts',
            error: { code: 'DATABASE_ERROR' },
            meta: { timestamp: new Date().toISOString() },
          });
          return;
        }

        res.status(200).json({
          success: true,
          message: 'Accounts retrieved successfully',
          data: {
            accounts: rows,
            pagination: {
              total,
              page,
              limit,
              total_pages: Math.ceil(total / limit),
            },
          },
          meta: { timestamp: new Date().toISOString() },
        });
      });
    });
  } catch (error) {
    logger.error('Error in getAccounts', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};
