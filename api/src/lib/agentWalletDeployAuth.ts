import { getAddress, isAddress, type Address } from 'viem';
import { config } from '../config.js';
import { readAgentCaptchaToken, verifyAgentCaptchaJwt } from './agentCaptchaVerify.js';

export type AgentWalletAuthMethod = 'captcha' | 'trusted_agent';

export type ResolvedAgentWalletAuth = {
  walletAddress: Address;
  agentId?: string;
  auth: AgentWalletAuthMethod;
};

function walletFromHeader(
  headers: { [k: string]: string | string[] | undefined },
): Address | null {
  const header = headers['x-wallet-address'] ?? headers['X-Wallet-Address'];
  const raw = typeof header === 'string' ? header.trim() : Array.isArray(header) ? header[0]?.trim() : '';
  if (!raw || !isAddress(raw)) return null;
  try {
    return getAddress(raw);
  } catch {
    return null;
  }
}

function walletFromAgentBody(body: {
  agentFeeRecipient?: unknown;
  wallet?: unknown;
}): Address | null {
  for (const field of [body.agentFeeRecipient, body.wallet]) {
    if (typeof field !== 'string') continue;
    const raw = field.trim();
    if (!raw || !isAddress(raw)) continue;
    try {
      return getAddress(raw);
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Authorize `feeTarget: agent_wallet` deploys/claims.
 * - Default: X-Agent-Captcha-JWT (haiku) binds the fee wallet.
 * - When `AGENT_DEPLOY_SKIP_CAPTCHA=true`: wallet from body or x-wallet-address (Bankr/X agents).
 */
export async function resolveAgentWalletAuth(
  headers: { [k: string]: string | string[] | undefined },
  body: { agentCaptchaJwt?: string; agentFeeRecipient?: unknown; wallet?: unknown },
): Promise<ResolvedAgentWalletAuth> {
  const captchaJwt = readAgentCaptchaToken(headers, body);
  if (captchaJwt) {
    const captchaPayload = await verifyAgentCaptchaJwt(captchaJwt);
    const walletAddress = getAddress(captchaPayload.walletAddress);
    return {
      walletAddress,
      agentId: captchaPayload.agentId,
      auth: 'captcha',
    };
  }

  if (config.agentDeploy.skipCaptcha) {
    const walletAddress = walletFromAgentBody(body) ?? walletFromHeader(headers);
    if (!walletAddress) {
      throw new Error(
        'Agent deploy requires a wallet when captcha is disabled — set agentFeeRecipient or wallet in JSON, or x-wallet-address header.',
      );
    }
    return { walletAddress, auth: 'trusted_agent' };
  }

  throw new Error(
    'Agent deploy requires X-Agent-Captcha-JWT header or agentCaptchaJwt in body. Set AGENT_DEPLOY_SKIP_CAPTCHA=true on the API to allow wallet-only agent deploys (Bankr/X).',
  );
}

export function agentDeploySkipCaptchaEnabled(): boolean {
  return config.agentDeploy.skipCaptcha;
}
