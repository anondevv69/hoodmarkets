import type { Express, Request, Response } from 'express';
import { BASE_WETH } from '../lib/liquidFactoryDeploy.js';
import { claimWethTradingFeesForFeeOwner } from '../lib/feeLockerClaim.js';
import {
  claimV3RewardsForToken,
  friendlyV3ClaimError,
  isV3CatalogDeployment,
} from '../lib/hoodmarketsV3Fees.js';
import {
  getDeploymentCatalogRowForPrivyClaimAuth,
  markDeploymentFeeClaimed,
} from '../lib/deploymentCatalog.js';
import { verifyPrivyBearerToken } from '../lib/privyAccessToken.js';
import { webDeployCorsHeaders } from '../lib/webDeployCors.js';

interface MyClaimBody {
  tokenAddress?: string;
  /** User’s connected wallet — required to authorize fee-recipient-only deployments (someone deployed for you). */
  walletAddress?: string;
}

/**
 * Authenticated claim route for web users.
 * - User proves identity via Privy bearer token.
 * - Token must appear in catalog for this user (deployer, privy-linked, or fee recipient when wallet matches).
 * - Server broadcasts claim tx (platform pays gas).
 */
export function registerMyDeploymentsClaimRoutes(app: Express): void {
  app.options('/api/my-deployments/claim', (req, res) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(204).end();
  });

  app.post('/api/my-deployments/claim', async (req: Request, res: Response) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);

    try {
      const { userId } = await verifyPrivyBearerToken(req.headers.authorization);
      const body = req.body as MyClaimBody;
      const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';

      if (!tokenAddress || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
        res.status(400).json({ error: 'tokenAddress is required and must be a valid 0x address.' });
        return;
      }

      const rawWallet =
        typeof body.walletAddress === 'string' ? body.walletAddress.trim() : '';
      const target = await getDeploymentCatalogRowForPrivyClaimAuth(
        userId,
        rawWallet,
        tokenAddress,
      );
      if (!target) {
        res.status(404).json({
          error: 'Token not found in your deployment history.',
        });
        return;
      }

      const feeOwner = target.feeRecipientAddress as `0x${string}`;
      const launchedToken = tokenAddress as `0x${string}`;
      const claimAsset = BASE_WETH;

      if (isV3CatalogDeployment(target)) {
        const out = await claimV3RewardsForToken(launchedToken);
        await markDeploymentFeeClaimed(tokenAddress, out.txHash);
        res.json({
          ok: true,
          txHash: out.txHash,
          basescanUrl: out.basescanUrl,
          feeModel: 'v3',
          feeOwner,
          token: launchedToken,
          message: out.message,
        });
        return;
      }

      const claimed = await claimWethTradingFeesForFeeOwner(feeOwner);
      if (!claimed.ok) {
        res.status(400).json({
          error: claimed.error,
          feeAmount: '0',
          feeOwner,
          token: launchedToken,
          claimAsset,
        });
        return;
      }

      const feeAmountWei = claimed.feeAmountWei;
      const feeHuman = Number(feeAmountWei) / 1e18;

      await markDeploymentFeeClaimed(tokenAddress, claimed.txHash);

      res.json({
        ok: true,
        txHash: claimed.txHash,
        basescanUrl: claimed.basescanUrl,
        feeAmount: feeAmountWei.toString(),
        feeAmountHuman: feeHuman.toFixed(6),
        feeTokenSymbol: 'ETH',
        feeAmountEth: feeHuman.toFixed(6),
        feeOwner,
        token: launchedToken,
        claimAsset,
        message: `Claim broadcasted. ${feeHuman.toFixed(6)} ETH (WETH) claimed for ${feeOwner}.`,
      });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Claim failed';
      const msg = /execution reverted|revert/i.test(raw.toLowerCase())
        ? friendlyV3ClaimError(raw)
        : raw;
      const status = /authorization|bearer|access token|privy/i.test(msg) ? 401 : 500;
      res.status(status).json({ error: msg });
    }
  });
}
