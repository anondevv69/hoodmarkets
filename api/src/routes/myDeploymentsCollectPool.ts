import type { Express, Request, Response } from 'express';
import { getDeploymentCatalogRowForPrivyClaimAuth, markDeploymentFeeClaimed } from '../lib/deploymentCatalog.js';
import {
  collectPoolFeesForLaunchedToken,
  friendlyCollectPoolError,
} from '../lib/deploymentFeeActions.js';
import {
  claimV3RewardsForToken,
  friendlyV3ClaimError,
  isV3CatalogDeployment,
} from '../lib/hoodmarketsV3Fees.js';
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

      const tok = tokenAddress as `0x${string}`;
      if (isV3CatalogDeployment(row)) {
        const out = await claimV3RewardsForToken(tok);
        await markDeploymentFeeClaimed(tokenAddress, out.txHash);
        res.json({ ok: true, ...out, feeModel: 'v3' });
        return;
      }

      const out = await collectPoolFeesForLaunchedToken(tok);
      res.json({ ok: true, ...out, feeModel: 'v4' });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Collect failed';
      const msg = /execution reverted|revert/i.test(raw.toLowerCase())
        ? friendlyV3ClaimError(raw)
        : friendlyCollectPoolError(raw);
      const status = /authorization|bearer|access token|privy/i.test(raw)
        ? 401
        : /execution reverted|revert/i.test(raw.toLowerCase())
          ? 400
          : 500;
      res.status(status).json({ error: msg });
    }
  });
}
