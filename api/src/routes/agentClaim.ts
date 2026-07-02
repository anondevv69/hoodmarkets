import type { Express, Request, Response } from 'express';
import { createPublicClient, createWalletClient, encodeFunctionData, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../config.js';
import { resolveAgentClaimDeployment } from '../lib/claimDeploymentAuth.js';
import { markDeploymentFeeClaimed } from '../lib/deploymentCatalog.js';
import { BASE_WETH } from '../lib/liquidFactoryDeploy.js';
import { webDeployCorsHeaders } from '../lib/webDeployCors.js';
import { readAgentCaptchaToken, verifyAgentCaptchaJwt } from '../lib/agentCaptchaVerify.js';

/** Fee locker ABI for checking and claiming fees */
const FEE_LOCKER_ABI = [
  {
    type: 'function',
    name: 'feesToClaim',
    inputs: [
      { name: 'feeOwner', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
  },
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
  /** Ticker — optional; if no tokenAddress, must uniquely identify one deployment for this fee wallet */
  tokenSymbol?: string;
  /** Full name — optional; use alone only if it uniquely identifies one deployment */
  tokenName?: string;
  agentCaptchaJwt?: string;
}

/**
 * Auto-claim flow for agents:
 * 1. Agent solves haiku CAPTCHA (gets JWT with walletAddress)
 * 2. Agent calls this endpoint with tokenAddress + JWT
 * 3. We check if there are claimable fees
 * 4. We broadcast the claim transaction from our deployer wallet
 * 5. We return the transaction hash and amount claimed
 *
 * Requires fresh haiku-solved CAPTCHA JWT in X-Agent-Captcha-JWT header.
 * No agent wallet needed — we broadcast the tx.
 */
export function registerAgentClaimRoutes(app: Express): void {
  app.options('/api/agent/claim', (req, res) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(204).end();
  });

  /** GET is wrong here — browsers and some “ping” tools use GET and see 404. Return 405 + hint. */
  app.get('/api/agent/claim', (req: Request, res: Response) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(405).json({
      error:
        'Use HTTP POST, not GET. hoodmarkets broadcasts the claim and pays gas. Send JSON with tokenAddress (0x…) and/or tokenSymbol and/or tokenName to identify your deployment, plus header X-Agent-Captcha-JWT (haiku JWT). Only the recorded fee recipient may claim.',
      method: 'POST',
      path: '/api/agent/claim',
    });
  });

  app.post('/api/agent/claim', async (req: Request, res: Response) => {
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

      // Extract wallet that will receive fees (the agent's fee wallet from CAPTCHA)
      const walletFromCaptcha = captchaPayload.walletAddress as `0x${string}`;

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

      const launchedToken = resolved.tokenAddress;
      const claimAsset = BASE_WETH;

      // Create public client to check claimable fees
      const publicClient = createPublicClient({
        chain: base,
        transport: http(config.baseRpcUrl),
      });

      // Trading/LP fees accrue as WETH in the locker (second arg), not the liquid token address.
      const feesClaim = await publicClient.readContract({
        address: config.liquid.feeLocker,
        abi: FEE_LOCKER_ABI,
        functionName: 'feesToClaim',
        args: [walletFromCaptcha, claimAsset],
      });

      if (feesClaim === 0n) {
        res.status(400).json({
          error: 'No fees to claim for this token.',
          feeAmount: '0',
        });
        return;
      }

      // Create wallet client to sign and broadcast the claim tx
      const account = privateKeyToAccount(config.deployerPrivateKey);
      const walletClient = createWalletClient({
        chain: base,
        transport: http(config.baseRpcUrl),
        account,
      });

      // Encode the claim function call
      const callData = encodeFunctionData({
        abi: FEE_LOCKER_ABI,
        functionName: 'claim',
        args: [walletFromCaptcha, claimAsset],
      });

      // Send the transaction
      const txHash = await walletClient.sendTransaction({
        to: config.liquid.feeLocker,
        data: callData,
        value: 0n,
      });

      // Wait for on-chain confirmation before marking as claimed
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') {
        res.status(500).json({
          error: `Claim transaction reverted (tx: ${txHash})`,
          txHash,
        });
        return;
      }

      // Format fee amount in ETH for readability
      const feeAmountWei = BigInt(feesClaim.toString());
      const feeAmountEth = Number(feeAmountWei) / 1e18;

      // Basescan link
      const basescanUrl = `https://basescan.org/tx/${txHash}`;

      await markDeploymentFeeClaimed(launchedToken, txHash);

      res.json({
        ok: true,
        chainId: base.id,
        txHash,
        basescanUrl,
        feeAmount: feesClaim.toString(),
        feeAmountEth: feeAmountEth.toFixed(6),
        feeOwner: walletFromCaptcha,
        token: launchedToken,
        claimAsset,
        message: `✅ Claimed ${feeAmountEth.toFixed(6)} ETH (WETH) for $${resolved.row.tokenSymbol} to ${walletFromCaptcha}`,
        claimLink: basescanUrl,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Claim failed';
      const status =
        /invalid|signature|jwt|captcha|missing|no fees/i.test(msg) && !/deploy/i.test(msg)
          ? 400
          : 500;
      res.status(status).json({ error: msg });
    }
  });
}
