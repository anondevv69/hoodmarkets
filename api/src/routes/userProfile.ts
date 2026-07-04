import type { Express, Request, Response } from 'express';
import { config } from '../config.js';
import {
  getBankrWalletForPrivyUser,
  linkBankrWalletForPrivyUser,
  unlinkBankrWalletForPrivyUser,
} from '../lib/hoodSocialDb.js';
import {
  buildLinkBankrWalletMessage,
  linkBankrWalletExpiresAt,
  verifyLinkBankrWalletSignature,
} from '../lib/linkBankrWallet.js';
import { fetchPrivyUserRecordById } from '../lib/privy.js';
import { verifyPrivyBearerToken } from '../lib/privyAccessToken.js';
import { webDeployCorsHeadersRead } from '../lib/webDeployCors.js';

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
    if (!config.privy.enabled) {
      res.status(503).json({ error: 'Privy is not configured on the server.' });
      return;
    }
    try {
      const { userId } = await verifyPrivyBearerToken(req.headers.authorization);
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
    if (!config.privy.enabled) {
      res.status(503).json({ error: 'Privy is not configured on the server.' });
      return;
    }
    try {
      const { userId } = await verifyPrivyBearerToken(req.headers.authorization);
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
    if (!config.privy.enabled) {
      res.status(503).json({ error: 'Privy is not configured on the server.' });
      return;
    }
    try {
      const { userId } = await verifyPrivyBearerToken(req.headers.authorization);
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
    if (!config.privy.enabled) {
      res.status(503).json({ error: 'Privy is not configured on the server.' });
      return;
    }
    try {
      const { userId } = await verifyPrivyBearerToken(req.headers.authorization);
      await unlinkBankrWalletForPrivyUser(userId);
      res.json({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unauthorized';
      res.status(/authorization|bearer|privy/i.test(msg) ? 401 : 500).json({ error: msg });
    }
  });
}
