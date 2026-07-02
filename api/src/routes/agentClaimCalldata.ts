import type { Express, Request, Response } from 'express';
import { encodeFunctionData } from 'viem';
import { base } from 'viem/chains';
import { config } from '../config.js';
import { resolveAgentClaimDeployment } from '../lib/claimDeploymentAuth.js';
import { BASE_WETH } from '../lib/liquidFactoryDeploy.js';
import { webDeployCorsHeaders } from '../lib/webDeployCors.js';
import { readAgentCaptchaToken, verifyAgentCaptchaJwt } from '../lib/agentCaptchaVerify.js';

/** Minimal fee locker ABI fragment for claim calldata */
const FEE_LOCKER_CLAIM_ABI = [
  {
    type: 'function',
    name: 'claim',
    inputs: [
      { name: 'feeOwner', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

interface ClaimBody {
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
  feeRecipient?: string;
  agentCaptchaJwt?: string;
}

/**
 * Returns unsigned tx calldata for `claim(feeOwner, token)` so the agent broadcasts with their wallet.
 * Requires fresh haiku-solved CAPTCHA JWT in X-Agent-Captcha-JWT header.
 * No EIP-191 signature needed — CAPTCHA JWT verification is the authorization.
 */
export function registerAgentClaimCalldataRoutes(app: Express): void {
  app.options('/api/agent/claim-calldata', (req, res) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(204).end();
  });

  app.post('/api/agent/claim-calldata', async (req: Request, res: Response) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);

    try {
      const body = req.body as ClaimBody;
      const captchaJwt = readAgentCaptchaToken(req.headers as any, body);
      if (!captchaJwt) {
        res.status(400).json({
          error:
            'Missing agent captcha JWT (X-Agent-Captcha-JWT or agentCaptchaJwt). Solve haiku challenge first.',
        });
        return;
      }

      let captchaPayload;
      try {
        captchaPayload = await verifyAgentCaptchaJwt(captchaJwt);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(401).json({ error: msg });
        return;
      }

      // Extract wallet address from CAPTCHA JWT — this is the authorized fee recipient for claiming
      const walletFromCaptcha = captchaPayload.walletAddress;

      const tokenAddressRaw = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';
      const tokenSymbolRaw = typeof body.tokenSymbol === 'string' ? body.tokenSymbol.trim() : '';
      const tokenNameRaw = typeof body.tokenName === 'string' ? body.tokenName.trim() : '';

      const resolved = await resolveAgentClaimDeployment({
        feeRecipient: walletFromCaptcha,
        tokenAddress: tokenAddressRaw || undefined,
        tokenSymbol: tokenSymbolRaw || undefined,
        tokenName: tokenNameRaw || undefined,
      });
      if (!resolved.ok) {
        res.status(resolved.status).json({ error: resolved.error });
        return;
      }

      const claimAsset = BASE_WETH;
      const data = encodeFunctionData({
        abi: FEE_LOCKER_CLAIM_ABI,
        functionName: 'claim',
        args: [walletFromCaptcha as `0x${string}`, claimAsset],
      });

      res.json({
        ok: true,
        chainId: base.id,
        to: config.liquid.feeLocker,
        data,
        value: '0x0',
        feeRecipient: walletFromCaptcha,
        tokenAddress: resolved.tokenAddress,
        claimAsset,
        hint:
          'Sign and broadcast from the fee recipient wallet. Claim pulls WETH from the Liquid fee locker for this deployment.',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Claim calldata failed';
      const status =
        /invalid|signature|jwt|captcha|missing/i.test(msg) && !/deploy/i.test(msg) ? 401 : 400;
      res.status(status).json({ error: msg });
    }
  });
}
