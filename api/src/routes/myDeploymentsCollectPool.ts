import type { Express, Request, Response } from 'express';
import { getDeploymentCatalogRowForPrivyClaimAuth } from '../lib/deploymentCatalog.js';
import {
  collectPoolFeesForLaunchedToken,
  friendlyCollectPoolError,
} from '../lib/deploymentFeeActions.js';
import { verifyPrivyBearerToken } from '../lib/privyAccessToken.js';
import { webDeployCorsHeaders } from '../lib/webDeployCors.js';

interface Body {
  tokenAddress?: string;
  /** Connected wallet — authorizes tokens deployed for you by someone else (fee recipient match). */
  walletAddress?: string;
}

/**
 * Pull accrued LP / pool fees into the fee locker (same step Liquid app does before claim).
 * `collectRewards` is permissionless on-chain; we broadcast from the launcher wallet so the user pays no gas.
 */
export function registerMyDeploymentsCollectPoolRoutes(app: Express): void {
  app.options('/api/my-deployments/collect-pool-fees', (req, res) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(204).end();
  });

  app.post('/api/my-deployments/collect-pool-fees', async (req: Request, res: Response) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);

    try {
      const { userId } = await verifyPrivyBearerToken(req.headers.authorization);
      const body = req.body as Body;
      const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';

      if (!tokenAddress || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
        res.status(400).json({ error: 'tokenAddress is required and must be a valid 0x address.' });
        return;
      }

      const rawWallet = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : '';
      const row = await getDeploymentCatalogRowForPrivyClaimAuth(userId, rawWallet, tokenAddress);
      if (!row) {
        res.status(404).json({ error: 'Token not found in your deployment history.' });
        return;
      }

      const out = await collectPoolFeesForLaunchedToken(tokenAddress as `0x${string}`);
      res.json({ ok: true, ...out });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Collect failed';
      const msg = friendlyCollectPoolError(raw);
      const status = /authorization|bearer|access token|privy/i.test(raw)
        ? 401
        : /execution reverted|revert/i.test(raw.toLowerCase())
          ? 400
          : 500;
      res.status(status).json({ error: msg });
    }
  });
}
