import { formatEther } from 'viem';
import { config } from '../config.js';
import { countDeployerDeploymentsCurrentEasternDay } from './deploymentCatalog.js';
import { agentDeployPaymentEnabled, agentDeployPaymentMinWei } from './agentDeployPaymentFlow.js';

const WEB_BASE = (process.env.LAUNCHER_WEB_URL || 'https://hood.markets').replace(/\/$/, '');

/** Eastern-day cap for free X/Bankr agent launches (`0` = unlimited). */
export function maxAgentXDeploysPerEasternDay(): number {
  return config.agentDeploy.maxXDeploysPerEasternDay;
}

export function agentXDeployLimitUserMessage(): string {
  const max = maxAgentXDeploysPerEasternDay();
  if (max <= 0) return 'Deploy rate limit reached. Try again later.';
  const launchWord = max === 1 ? 'launch' : 'launches';
  if (agentDeployPaymentEnabled()) {
    const eth = formatEther(agentDeployPaymentMinWei());
    return (
      `You can only do ${max} free token ${launchWord} per day on X. ` +
      `Pay ${eth} ETH from your Bankr wallet to launch again today, or visit ${WEB_BASE}.`
    );
  }
  return (
    `You can only do ${max} free token ${launchWord} per day on X. ` +
    `For more launches, visit ${WEB_BASE} and sign in — you pay gas and pool seed from your wallet.`
  );
}

/** Short copy for @bankrbot tweet replies. */
export function agentXDeployLimitReplyHint(): string {
  const max = maxAgentXDeploysPerEasternDay();
  if (max <= 0) return 'Deploy rate limit reached on hood.markets — try again later.';
  if (agentDeployPaymentEnabled()) {
    const eth = formatEther(agentDeployPaymentMinWei());
    return (
      `You've used your ${max} free X launch${max === 1 ? '' : 'es'} for today. ` +
      `Pay ${eth} ETH from your Bankr wallet to launch again (POST /api/deploy returns payment steps), or go to ${WEB_BASE}.`
    );
  }
  return (
    `You've used your ${max} free X launch${max === 1 ? '' : 'es'} for today on hood.markets. ` +
    `Launch more at ${WEB_BASE} (sign in + wallet). Resets at midnight Eastern.`
  );
}

export function agentXDeployPaymentReplyHint(): string {
  const eth = formatEther(agentDeployPaymentMinWei());
  return (
    `Your free X launch for today is used. Pay ${eth} ETH from your Bankr wallet, then retry deploy with paymentTxHash.`
  );
}

export function isAgentXChannel(channel: string | null | undefined): boolean {
  if (!channel) return false;
  const c = channel.trim().toLowerCase();
  return c === 'x' || c === 'twitter' || c === 'tweet';
}

/** `null` when under limit. */
export async function agentXDeployLimitErrorOrNull(deployerId: string): Promise<string | null> {
  const max = maxAgentXDeploysPerEasternDay();
  if (max <= 0) return null;
  if (!deployerId.startsWith('agent:')) return null;
  const n = await countDeployerDeploymentsCurrentEasternDay('web', deployerId);
  if (n >= max) return agentXDeployLimitUserMessage();
  return null;
}
