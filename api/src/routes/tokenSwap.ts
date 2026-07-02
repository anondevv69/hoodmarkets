import type { Express, Request, Response } from 'express';
import { getAddress } from 'viem';
import { config } from '../config.js';
import { getDeploymentByTokenAddress } from '../lib/deploymentCatalog.js';
import {
  buildHoodmarketsPoolKey,
  wethToTokenZeroForOne,
} from '../lib/hoodmarketsPoolKey.js';
import { ROBINHOOD_WETH } from '../lib/robinhoodChain.js';
import { webDeployCorsHeadersRead } from '../lib/webDeployCors.js';

const DEFAULT_UNIVERSAL_ROUTER =
  '0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77' as const;

function swapAddresses() {
  return {
    weth: (process.env.WETH?.trim() || ROBINHOOD_WETH) as `0x${string}`,
    universalRouter: (process.env.UNISWAP_UNIVERSAL_ROUTER?.trim() ||
      DEFAULT_UNIVERSAL_ROUTER) as `0x${string}`,
    hookStatic: config.liquid.hookStatic,
  };
}

export function registerTokenSwapRoutes(app: Express): void {
  app.options('/api/tokens/:tokenAddress/swap-config', (req, res) => {
    const h = webDeployCorsHeadersRead(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(204).end();
  });

  app.get('/api/tokens/:tokenAddress/swap-config', async (req: Request, res: Response) => {
    const h = webDeployCorsHeadersRead(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);

    const raw = typeof req.params.tokenAddress === 'string' ? req.params.tokenAddress.trim() : '';
    if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
      res.status(400).json({ error: 'tokenAddress must be a valid 0x contract address.' });
      return;
    }

    let tokenAddress: `0x${string}`;
    try {
      tokenAddress = getAddress(raw);
    } catch {
      res.status(400).json({ error: 'Invalid token address checksum.' });
      return;
    }

    const deployment = await getDeploymentByTokenAddress(tokenAddress);
    if (!deployment) {
      res.status(404).json({ error: 'Token not found in hoodmarkets catalog.' });
      return;
    }

    const { weth, universalRouter, hookStatic } = swapAddresses();
    if (!hookStatic) {
      res.status(503).json({ error: 'Swap is not configured (missing hook address).' });
      return;
    }

    const poolKey = buildHoodmarketsPoolKey(tokenAddress, hookStatic, weth);
    const zeroForOne = wethToTokenZeroForOne(poolKey, weth);

    res.json({
      chainId: 4663,
      tokenAddress,
      poolId: deployment.poolId,
      poolKey,
      weth,
      universalRouter,
      /** ETH → token: WETH is tokenIn. */
      zeroForOne,
      pairedToken: weth,
    });
  });
}
