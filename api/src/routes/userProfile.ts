import type { Express, Request, Response } from 'express';
import { config } from '../config.js';
import {
  getBankrWalletForPrivyUser,
  linkBankrWalletForPrivyUser,
  unlinkBankrWalletForPrivyUser,
  getXLinkForWallet,
  getXLinkChallenge,
  upsertXLinkChallenge,
  deleteXLinkChallenge,
  linkXHandleForWallet,
  unlinkXHandleForWallet,
} from '../lib/hoodSocialDb.js';
import {
  buildLinkBankrWalletMessage,
  linkBankrWalletExpiresAt,
  verifyLinkBankrWalletSignature,
} from '../lib/linkBankrWallet.js';
import {
  buildXLinkVerifyUrl,
  generateXLinkVerifyCode,
  xLinkVerifyExpiresAt,
  xProfileContainsVerification,
} from '../lib/linkXVerify.js';
import { fetchXUserProfileByUsername } from '../lib/xUserLookup.js';
import { fetchPrivyUserRecordById } from '../lib/privy.js';
import { verifyWebSessionBearer } from '../lib/webSessionAuth.js';
import { webDeployCorsHeadersRead } from '../lib/webDeployCors.js';

function normalizeXHandle(raw: unknown): string | null {
  const handle =
    typeof raw === 'string' ? raw.trim().replace(/^@/, '').toLowerCase() : '';
  if (!handle || !/^[a-z0-9_]{1,50}$/.test(handle)) return null;
  return handle;
}

const WEB_BASE = (process.env.LAUNCHER_WEB_URL || 'https://hood.markets').replace(/\/$/, '');

function setCors(req: Request, res: Response): void {
  const h = webDeployCorsHeadersRead(req.headers.origin);
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
}

export function registerUserProfileRoutes(app: Express): void {
  app.options('/api/my-profile/bankr', (req, res) => {
    setCors(req, res);
    res.status(204).end();
  });

  app.options('/api/my-profile/link-bankr', (req, res) => {
    setCors(req, res);
    res.status(204).end();
  });

  app.get('/api/my-profile/bankr', async (req: Request, res: Response) => {
    setCors(req, res);
    if (!config.webWallet.enabled && !config.privy.enabled) {
      res.status(503).json({ error: 'Web login is not configured on the server.' });
      return;
    }
    try {
      const { userId } = await verifyWebSessionBearer(req.headers.authorization);
      const bankrWallet = await getBankrWalletForPrivyUser(userId);
      res.json({ linked: !!bankrWallet, bankrWallet });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unauthorized';
      res.status(/authorization|bearer|privy/i.test(msg) ? 401 : 500).json({ error: msg });
    }
  });

  app.options('/api/my-profile/link-bankr/challenge', (req, res) => {
    setCors(req, res);
    res.status(204).end();
  });

  app.post('/api/my-profile/link-bankr/challenge', async (req: Request, res: Response) => {
    setCors(req, res);
    if (!config.webWallet.enabled && !config.privy.enabled) {
      res.status(503).json({ error: 'Web login is not configured on the server.' });
      return;
    }
    try {
      const { userId } = await verifyWebSessionBearer(req.headers.authorization);
      const walletAddress =
        typeof req.body?.walletAddress === 'string' ? req.body.walletAddress.trim() : '';
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        res.status(400).json({ error: 'walletAddress must be a valid 0x address.' });
        return;
      }
      const expiresAtMs = linkBankrWalletExpiresAt();
      const message = buildLinkBankrWalletMessage(userId, walletAddress, expiresAtMs);
      res.json({ message, expiresAtMs, walletAddress });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unauthorized';
      res.status(/authorization|bearer|privy/i.test(msg) ? 401 : 500).json({ error: msg });
    }
  });

  app.post('/api/my-profile/link-bankr', async (req: Request, res: Response) => {
    setCors(req, res);
    if (!config.webWallet.enabled && !config.privy.enabled) {
      res.status(503).json({ error: 'Web login is not configured on the server.' });
      return;
    }
    try {
      const { userId } = await verifyWebSessionBearer(req.headers.authorization);
      const walletAddress =
        typeof req.body?.walletAddress === 'string' ? req.body.walletAddress.trim() : '';
      const signature =
        typeof req.body?.signature === 'string' ? req.body.signature.trim() : '';
      const expiresAtMs = Number(req.body?.expiresAtMs);

      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        res.status(400).json({ error: 'walletAddress must be a valid 0x address.' });
        return;
      }
      if (!/^0x[a-fA-F0-9]+$/.test(signature)) {
        res.status(400).json({ error: 'signature is required.' });
        return;
      }

      await verifyLinkBankrWalletSignature({
        privyUserId: userId,
        walletAddress,
        expiresAtMs,
        signature: signature as `0x${string}`,
      });

      await linkBankrWalletForPrivyUser(userId, walletAddress);
      res.json({ ok: true, bankrWallet: walletAddress });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Link failed';
      const status = /authorization|bearer|privy/i.test(msg)
        ? 401
        : /signature|expired|invalid/i.test(msg)
          ? 400
          : 500;
      res.status(status).json({ error: msg });
    }
  });

  app.delete('/api/my-profile/link-bankr', async (req: Request, res: Response) => {
    setCors(req, res);
    if (!config.webWallet.enabled && !config.privy.enabled) {
      res.status(503).json({ error: 'Web login is not configured on the server.' });
      return;
    }
    try {
      const { userId } = await verifyWebSessionBearer(req.headers.authorization);
      await unlinkBankrWalletForPrivyUser(userId);
      res.json({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unauthorized';
      res.status(/authorization|bearer|privy/i.test(msg) ? 401 : 500).json({ error: msg });
    }
  });

  const xPaths = [
    '/api/my-profile/x',
    '/api/my-profile/link-x',
    '/api/my-profile/link-x/challenge',
    '/api/my-profile/link-x/verify',
  ];
  for (const path of xPaths) {
    app.options(path, (req, res) => {
      setCors(req, res);
      res.status(204).end();
    });
  }

  app.get('/api/my-profile/x', async (req: Request, res: Response) => {
    setCors(req, res);
    try {
      const session = await verifyWebSessionBearer(req.headers.authorization);
      const walletAddress = session.kind === 'wallet' ? session.walletAddress : null;
      if (!walletAddress) {
        res.json({ linked: false, xHandle: null, verified: false });
        return;
      }
      const link = await getXLinkForWallet(walletAddress);
      const challenge = await getXLinkChallenge(walletAddress);
      res.json({
        linked: !!link?.xHandle,
        xHandle: link?.xHandle ?? null,
        verified: !!link?.verifiedAt,
        pendingChallenge: challenge
          ? {
              xHandle: challenge.xHandle,
              verifyCode: challenge.verifyCode,
              verifyUrl: buildXLinkVerifyUrl(WEB_BASE, challenge.verifyCode),
              expiresAtMs: challenge.expiresAtMs,
            }
          : null,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unauthorized';
      res.status(/authorization|bearer/i.test(msg) ? 401 : 500).json({ error: msg });
    }
  });

  app.post('/api/my-profile/link-x/challenge', async (req: Request, res: Response) => {
    setCors(req, res);
    try {
      const session = await verifyWebSessionBearer(req.headers.authorization);
      if (session.kind !== 'wallet') {
        res.status(400).json({ error: 'X linking requires wallet sign-in.' });
        return;
      }
      const handle = normalizeXHandle(req.body?.xHandle);
      if (!handle) {
        res.status(400).json({
          error: 'xHandle must be a valid X username (letters, numbers, underscores, max 50 chars).',
        });
        return;
      }
      const verifyCode = generateXLinkVerifyCode();
      const expiresAtMs = xLinkVerifyExpiresAt();
      await upsertXLinkChallenge(session.walletAddress, handle, verifyCode, expiresAtMs);
      const verifyUrl = buildXLinkVerifyUrl(WEB_BASE, verifyCode);
      res.json({
        ok: true,
        xHandle: handle,
        verifyCode,
        verifyUrl,
        expiresAtMs,
        instructions: [
          `Open your X profile settings for @${handle}.`,
          `Set Website to ${WEB_BASE} or ${verifyUrl}.`,
          `Or add this code to your bio: ${verifyCode}`,
          'Save, then click "Check verification" below.',
        ],
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Challenge failed';
      res.status(/authorization|bearer/i.test(msg) ? 401 : 500).json({ error: msg });
    }
  });

  app.post('/api/my-profile/link-x/verify', async (req: Request, res: Response) => {
    setCors(req, res);
    try {
      const session = await verifyWebSessionBearer(req.headers.authorization);
      if (session.kind !== 'wallet') {
        res.status(400).json({ error: 'X linking requires wallet sign-in.' });
        return;
      }
      const handle = normalizeXHandle(req.body?.xHandle);
      if (!handle) {
        res.status(400).json({ error: 'xHandle is required.' });
        return;
      }
      const challenge = await getXLinkChallenge(session.walletAddress);
      if (!challenge || challenge.xHandle !== handle) {
        res.status(400).json({
          error: 'Start verification first — enter your @handle and click "Start verification".',
        });
        return;
      }
      const profile = await fetchXUserProfileByUsername(handle);
      if (!profile) {
        res.status(400).json({
          error: 'Could not load that X profile. Check the username or try again in a minute.',
        });
        return;
      }
      const ok = xProfileContainsVerification(profile, handle, challenge.verifyCode);
      if (!ok) {
        res.status(400).json({
          error: `Verification not found on @${handle}. Add ${WEB_BASE} or code ${challenge.verifyCode} to your X website or bio, save, then try again.`,
        });
        return;
      }
      await linkXHandleForWallet(session.walletAddress, handle, true);
      await deleteXLinkChallenge(session.walletAddress);
      res.json({ ok: true, xHandle: handle, verified: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Verification failed';
      res.status(/authorization|bearer/i.test(msg) ? 401 : 500).json({ error: msg });
    }
  });

  app.post('/api/my-profile/link-x', async (req: Request, res: Response) => {
    setCors(req, res);
    try {
      const session = await verifyWebSessionBearer(req.headers.authorization);
      if (session.kind !== 'wallet') {
        res.status(400).json({ error: 'X linking requires wallet sign-in.' });
        return;
      }
      const handle = normalizeXHandle(req.body?.xHandle);
      if (!handle) {
        res.status(400).json({
          error: 'xHandle must be a valid X username (letters, numbers, underscores, max 50 chars).',
        });
        return;
      }
      await linkXHandleForWallet(session.walletAddress, handle, false);
      res.json({ ok: true, xHandle: handle, verified: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Link failed';
      res.status(/authorization|bearer/i.test(msg) ? 401 : 500).json({ error: msg });
    }
  });

  app.delete('/api/my-profile/link-x', async (req: Request, res: Response) => {
    setCors(req, res);
    try {
      const session = await verifyWebSessionBearer(req.headers.authorization);
      if (session.kind !== 'wallet') {
        res.status(400).json({ error: 'X linking requires wallet sign-in.' });
        return;
      }
      await unlinkXHandleForWallet(session.walletAddress);
      await deleteXLinkChallenge(session.walletAddress);
      res.json({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unauthorized';
      res.status(/authorization|bearer/i.test(msg) ? 401 : 500).json({ error: msg });
    }
  });
}
