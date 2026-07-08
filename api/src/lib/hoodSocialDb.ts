import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { getAddress } from 'viem';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../.data');
const dbPath = path.join(dataDir, 'hood-social.db');

let db: sqlite3.Database | null = null;

export type TokenSpacePostRow = {
  id: number;
  tokenAddress: string;
  walletAddress: string;
  body: string;
  createdAt: string;
};

function run(sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('hood-social DB not initialized'));
      return;
    }
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

function get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('hood-social DB not initialized'));
      return;
    }
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row as T | undefined)));
  });
}

function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('hood-social DB not initialized'));
      return;
    }
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve((rows as T[]) ?? [])));
  });
}

export function initHoodSocialDb(): void {
  if (db) return;
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch (err: unknown) {
    logger.warn('hoodSocialDb: failed to create .data directory:', (err as Error).message);
  }

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) logger.error('hoodSocialDb: failed to open database:', err.message);
    else logger.info('Hood social DB ready:', dbPath);
  });

  db.serialize(() => {
    db!.run(
      `CREATE TABLE IF NOT EXISTS user_bankr_links (
        privy_user_id TEXT PRIMARY KEY,
        bankr_wallet TEXT NOT NULL,
        linked_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    db!.run(
      `CREATE INDEX IF NOT EXISTS idx_user_bankr_wallet ON user_bankr_links(bankr_wallet)`,
    );
    db!.run(
      `CREATE TABLE IF NOT EXISTS token_space_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_address TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    db!.run(
      `CREATE INDEX IF NOT EXISTS idx_token_space_posts_token ON token_space_posts(token_address, created_at DESC)`,
    );
    db!.run(
      `CREATE TABLE IF NOT EXISTS user_x_links (
        wallet_address TEXT PRIMARY KEY,
        x_handle TEXT NOT NULL,
        linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        verified_at DATETIME
      )`,
    );
    db!.run(`ALTER TABLE user_x_links ADD COLUMN verified_at DATETIME`, () => undefined);
    db!.run(
      `CREATE INDEX IF NOT EXISTS idx_user_x_handle ON user_x_links(x_handle)`,
    );
    db!.run(
      `CREATE TABLE IF NOT EXISTS user_x_link_challenges (
        wallet_address TEXT PRIMARY KEY,
        x_handle TEXT NOT NULL,
        verify_code TEXT NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    );
  });
}

export function closeHoodSocialDb(): void {
  if (!db) return;
  db.close();
  db = null;
}

export async function getBankrWalletForPrivyUser(privyUserId: string): Promise<string | null> {
  const row = await get<{ bankr_wallet: string }>(
    `SELECT bankr_wallet FROM user_bankr_links WHERE privy_user_id = ?`,
    [privyUserId],
  );
  if (!row?.bankr_wallet) return null;
  try {
    return getAddress(row.bankr_wallet);
  } catch {
    return null;
  }
}

export async function linkBankrWalletForPrivyUser(
  privyUserId: string,
  bankrWallet: string,
): Promise<void> {
  const wallet = getAddress(bankrWallet);
  await run(
    `INSERT INTO user_bankr_links (privy_user_id, bankr_wallet, linked_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(privy_user_id) DO UPDATE SET
       bankr_wallet = excluded.bankr_wallet,
       linked_at = CURRENT_TIMESTAMP`,
    [privyUserId, wallet.toLowerCase()],
  );
}

export async function unlinkBankrWalletForPrivyUser(privyUserId: string): Promise<void> {
  await run(`DELETE FROM user_bankr_links WHERE privy_user_id = ?`, [privyUserId]);
}

export async function listTokenSpacePosts(
  tokenAddress: string,
  limit = 50,
  offset = 0,
): Promise<TokenSpacePostRow[]> {
  const token = getAddress(tokenAddress).toLowerCase();
  const rows = await all<{
    id: number;
    token_address: string;
    wallet_address: string;
    body: string;
    created_at: string;
  }>(
    `SELECT id, token_address, wallet_address, body, created_at
     FROM token_space_posts
     WHERE lower(token_address) = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [token, limit, offset],
  );
  return rows.map((r) => ({
    id: r.id,
    tokenAddress: r.token_address,
    walletAddress: r.wallet_address,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function insertTokenSpacePost(
  tokenAddress: string,
  walletAddress: string,
  body: string,
): Promise<number> {
  const token = getAddress(tokenAddress).toLowerCase();
  const wallet = getAddress(walletAddress).toLowerCase();
  const trimmed = body.trim().slice(0, 2000);
  if (!trimmed) throw new Error('Post body is empty.');
  await run(
    `INSERT INTO token_space_posts (token_address, wallet_address, body)
     VALUES (?, ?, ?)`,
    [token, wallet, trimmed],
  );
  const row = await get<{ id: number }>(`SELECT last_insert_rowid() AS id`);
  return row?.id ?? 0;
}

export async function getXHandleForWallet(walletAddress: string): Promise<string | null> {
  const link = await getXLinkForWallet(walletAddress);
  return link?.xHandle ?? null;
}

export type WalletXLink = {
  xHandle: string;
  verifiedAt: string | null;
  linkedAt: string;
};

export async function getXLinkForWallet(walletAddress: string): Promise<WalletXLink | null> {
  const wallet = getAddress(walletAddress).toLowerCase();
  const row = await get<{ x_handle: string; verified_at: string | null; linked_at: string }>(
    `SELECT x_handle, verified_at, linked_at FROM user_x_links WHERE wallet_address = ?`,
    [wallet],
  );
  if (!row?.x_handle) return null;
  return {
    xHandle: row.x_handle,
    verifiedAt: row.verified_at ?? null,
    linkedAt: row.linked_at,
  };
}

export async function linkXHandleForWallet(
  walletAddress: string,
  xHandle: string,
  verified = false,
): Promise<void> {
  const wallet = getAddress(walletAddress).toLowerCase();
  const handle = xHandle.trim().replace(/^@/, '').toLowerCase().slice(0, 64);
  if (!handle) throw new Error('xHandle is required.');
  if (verified) {
    await run(
      `INSERT INTO user_x_links (wallet_address, x_handle, linked_at, verified_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(wallet_address) DO UPDATE SET
         x_handle = excluded.x_handle,
         linked_at = CURRENT_TIMESTAMP,
         verified_at = CURRENT_TIMESTAMP`,
      [wallet, handle],
    );
    return;
  }
  await run(
    `INSERT INTO user_x_links (wallet_address, x_handle, linked_at, verified_at)
     VALUES (?, ?, CURRENT_TIMESTAMP, NULL)
     ON CONFLICT(wallet_address) DO UPDATE SET
       x_handle = excluded.x_handle,
       linked_at = CURRENT_TIMESTAMP`,
    [wallet, handle],
  );
}

export type XLinkChallengeRow = {
  xHandle: string;
  verifyCode: string;
  expiresAtMs: number;
};

export async function upsertXLinkChallenge(
  walletAddress: string,
  xHandle: string,
  verifyCode: string,
  expiresAtMs: number,
): Promise<void> {
  const wallet = getAddress(walletAddress).toLowerCase();
  const handle = xHandle.trim().replace(/^@/, '').toLowerCase().slice(0, 64);
  await run(
    `INSERT INTO user_x_link_challenges (wallet_address, x_handle, verify_code, expires_at_ms)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(wallet_address) DO UPDATE SET
       x_handle = excluded.x_handle,
       verify_code = excluded.verify_code,
       expires_at_ms = excluded.expires_at_ms,
       created_at = CURRENT_TIMESTAMP`,
    [wallet, handle, verifyCode, expiresAtMs],
  );
}

export async function getXLinkChallenge(walletAddress: string): Promise<XLinkChallengeRow | null> {
  const wallet = getAddress(walletAddress).toLowerCase();
  const row = await get<{ x_handle: string; verify_code: string; expires_at_ms: number }>(
    `SELECT x_handle, verify_code, expires_at_ms FROM user_x_link_challenges WHERE wallet_address = ?`,
    [wallet],
  );
  if (!row) return null;
  if (row.expires_at_ms < Date.now()) {
    await deleteXLinkChallenge(wallet);
    return null;
  }
  return {
    xHandle: row.x_handle,
    verifyCode: row.verify_code,
    expiresAtMs: row.expires_at_ms,
  };
}

export async function deleteXLinkChallenge(walletAddress: string): Promise<void> {
  const wallet = getAddress(walletAddress).toLowerCase();
  await run(`DELETE FROM user_x_link_challenges WHERE wallet_address = ?`, [wallet]);
}

export async function unlinkXHandleForWallet(walletAddress: string): Promise<void> {
  const wallet = getAddress(walletAddress).toLowerCase();
  await run(`DELETE FROM user_x_links WHERE wallet_address = ?`, [wallet]);
}
