import type { Express, Request, Response } from 'express';
import { createPublicClient, createWalletClient, encodeFunctionData, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../config.js';
import { getDeploymentCatalogRowForPrivyClaimAuth } from '../lib/deploymentCatalog.js';
import { LIQUID_LP_LOCKER_COLLECT_ABI } from '../lib/liquidLpLockerCollectAbi.js';
import { robinhood, robinhoodTxUrl } from '../lib/robinhoodChain.js';
import { verifyPrivyBearerToken } from '../lib/privyAccessToken.js';
import { webDeployCorsHeaders } from '../lib/webDeployCors.js';

interface Body {
  tokenAddress?: string;
  /** Connected wallet — authorizes tokens deployed for you by someone else (fee recipient match). */
  walletAddress?: string;
}

function friendlyCollectError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('execution reverted')) {
    return (
      'Could not collect pool fees yet. The pool may still be in its anti-sniper window, ' +
      'or no LP fees have accrued. Try again after more trading activity.'
    );
  }
  if (lower.includes('insufficient funds')) {
    return 'Launcher wallet is low on gas. Contact hood.markets support.';
  }
  return msg;
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

      const token = tokenAddress as `0x${string}`;
      const lpLocker = config.liquid.lpLocker;
      if (!lpLocker) {
        res.status(500).json({ error: 'LP locker address is not configured on the API.' });
        return;
      }

      const account = privateKeyToAccount(config.deployerPrivateKey);
      const publicClient = createPublicClient({
        chain: robinhood,
        transport: http(config.chainRpcUrl),
      });
      const walletClient = createWalletClient({
        chain: robinhood,
        transport: http(config.chainRpcUrl),
        account,
      });

      const data = encodeFunctionData({
        abi: LIQUID_LP_LOCKER_COLLECT_ABI,
        functionName: 'collectRewards',
        args: [token],
      });

      await publicClient.simulateContract({
        address: lpLocker,
        abi: LIQUID_LP_LOCKER_COLLECT_ABI,
        functionName: 'collectRewards',
        args: [token],
        account: account.address,
      });

      const txHash = await walletClient.sendTransaction({
        to: lpLocker,
        data,
        value: 0n,
      });

      const basescanUrl = robinhoodTxUrl(txHash);

      res.json({
        ok: true,
        txHash,
        basescanUrl,
        message:
          'Pool fees collected into the fee locker (if any were available). Use Claim fees after trading generates fees.',
      });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Collect failed';
      const msg = friendlyCollectError(raw);
      const status = /authorization|bearer|access token|privy/i.test(raw)
        ? 401
        : /execution reverted|revert/i.test(raw.toLowerCase())
          ? 400
          : 500;
      res.status(status).json({ error: msg });
    }
  });
}
