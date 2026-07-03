import type { Express, Request, Response } from 'express';
import { getAddress } from 'viem';
import {
  claimWethFeesForLaunchedToken,
  collectPoolFeesForLaunchedToken,
  friendlyCollectPoolError,
  readPendingWethFeesForFeeOwner,
} from '../lib/deploymentFeeActions.js';
import {
  getDeploymentByTokenAddress,
  markDeploymentFeeClaimed,
} from '../lib/deploymentCatalog.js';
import { isHoodmarketsPlatformFeeRecipientLabel } from '../lib/platformFeeRecipient.js';
import { webDeployCorsHeaders } from '../lib/webDeployCors.js';

function parseTokenParam(raw: string): `0x${string}` | null {
  const trimmed = raw.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return null;
  try {
    return getAddress(trimmed) as `0x${string}`;
  } catch {
    return null;
  }
}

function applyCors(req: Request, res: Response): void {
  const h = webDeployCorsHeaders(req.headers.origin);
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
}

/**
 * Public fee pull for any hood.markets token — on-chain collect/claim are permissionless;
 * we broadcast from the launcher wallet so anyone can help the fee recipient without gas.
 */
export function registerDeploymentFeeActionRoutes(app: Express): void {
  for (const path of [
    '/api/deployments/:tokenAddress/fee-status',
    '/api/deployments/:tokenAddress/collect-pool-fees',
    '/api/deployments/:tokenAddress/claim-fees',
  ]) {
    app.options(path, (req, res) => {
      applyCors(req, res);
      res.status(204).end();
    });
  }

  app.get('/api/deployments/:tokenAddress/fee-status', async (req: Request, res: Response) => {
    applyCors(req, res);
    const tokenAddress = parseTokenParam(
      typeof req.params.tokenAddress === 'string' ? req.params.tokenAddress : '',
    );
    if (!tokenAddress) {
      res.status(400).json({ error: 'tokenAddress must be a valid 0x contract address.' });
      return;
    }

    try {
      const row = await getDeploymentByTokenAddress(tokenAddress);
      if (!row) {
        res.status(404).json({ error: 'Token not found in hoodmarkets catalog.' });
        return;
      }

      const platformFees = isHoodmarketsPlatformFeeRecipientLabel(row.feeRecipientLabel);
      const feeOwner = row.feeRecipientAddress as `0x${string}`;
      const pendingWei = platformFees ? 0n : await readPendingWethFeesForFeeOwner(feeOwner);
      const pendingHuman = Number(pendingWei) / 1e18;

      res.json({
        feeRecipientAddress: feeOwner,
        platformFees,
        pendingWethWei: pendingWei.toString(),
        pendingWethHuman: pendingHuman.toFixed(6),
        feeClaimedAt: row.feeClaimedAt?.trim() || undefined,
        feeClaimTxHash: row.feeClaimTxHash?.trim() || undefined,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load fee status.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/deployments/:tokenAddress/collect-pool-fees', async (req: Request, res: Response) => {
    applyCors(req, res);
    const tokenAddress = parseTokenParam(
      typeof req.params.tokenAddress === 'string' ? req.params.tokenAddress : '',
    );
    if (!tokenAddress) {
      res.status(400).json({ error: 'tokenAddress must be a valid 0x contract address.' });
      return;
    }

    try {
      const row = await getDeploymentByTokenAddress(tokenAddress);
      if (!row) {
        res.status(404).json({ error: 'Token not found in hoodmarkets catalog.' });
        return;
      }
      if (isHoodmarketsPlatformFeeRecipientLabel(row.feeRecipientLabel)) {
        res.status(400).json({ error: 'Trading fees for this token go to the hood.markets platform wallet.' });
        return;
      }

      const out = await collectPoolFeesForLaunchedToken(tokenAddress);
      res.json({ ok: true, ...out, feeRecipientAddress: row.feeRecipientAddress });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Collect failed';
      const msg = friendlyCollectPoolError(raw);
      const status = /execution reverted|revert/i.test(raw.toLowerCase()) ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  });

  app.post('/api/deployments/:tokenAddress/claim-fees', async (req: Request, res: Response) => {
    applyCors(req, res);
    const tokenAddress = parseTokenParam(
      typeof req.params.tokenAddress === 'string' ? req.params.tokenAddress : '',
    );
    if (!tokenAddress) {
      res.status(400).json({ error: 'tokenAddress must be a valid 0x contract address.' });
      return;
    }

    try {
      const row = await getDeploymentByTokenAddress(tokenAddress);
      if (!row) {
        res.status(404).json({ error: 'Token not found in hoodmarkets catalog.' });
        return;
      }
      if (isHoodmarketsPlatformFeeRecipientLabel(row.feeRecipientLabel)) {
        res.status(400).json({ error: 'Trading fees for this token go to the hood.markets platform wallet.' });
        return;
      }

      const feeOwner = row.feeRecipientAddress as `0x${string}`;
      const claimed = await claimWethFeesForLaunchedToken(feeOwner);
      if (!claimed.ok) {
        res.status(400).json({
          error: claimed.error,
          feeAmount: '0',
          feeRecipientAddress: feeOwner,
        });
        return;
      }

      const feeHuman = Number(claimed.feeAmountWei) / 1e18;
      await markDeploymentFeeClaimed(tokenAddress, claimed.txHash);

      res.json({
        ok: true,
        txHash: claimed.txHash,
        basescanUrl: claimed.basescanUrl,
        feeAmountHuman: feeHuman.toFixed(6),
        feeRecipientAddress: feeOwner,
        message: `Claimed ${feeHuman.toFixed(6)} ETH (WETH) to ${feeOwner}.`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Claim failed';
      res.status(500).json({ error: msg });
    }
  });
}
