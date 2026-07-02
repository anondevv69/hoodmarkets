export interface ExistingDeployToken {
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
}

export interface DeployCooldownConflict {
  kind: 'ticker' | 'name';
  cooldownHours: number;
  requestedSymbol?: string;
  requestedName?: string;
  existing: ExistingDeployToken;
}

export class DeployApiError extends Error {
  conflict?: DeployCooldownConflict;

  constructor(message: string, conflict?: DeployCooldownConflict) {
    super(message);
    this.name = 'DeployApiError';
    this.conflict = conflict;
  }
}

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:3000';

export interface Deployment {
  id: number;
  createdAt: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenImageUrl?: string;
  tokenWebsiteUrl?: string;
  tokenXUrl?: string;
  transactionHash: string;
  feeRecipientAddress: string;
  feeRecipientLabel?: string;
  feeToSelf?: boolean;
  deployerLabel: string;
  chain: string;
}

export type TokenDetail = Deployment & {
  poolId?: string;
  platform?: string;
};

export interface WebDeployConfig {
  chainId: number;
  deployDefaultChain: string;
  strictDeployRateLimits: boolean;
  globalTickerCooldownHours: number;
  maxSelfFeeDeploysPer24h: number;
  deployRateLimitHours: number;
  platformFeeBps: number;
  platformFeePercent: number;
  imageUploadEnabled: boolean;
}

export interface DeployResult {
  ok: boolean;
  tokenAddress: string;
  transactionHash: string;
  feeWallet: string;
  imageUrl?: string;
  links?: Record<string, string>;
}

export interface CooldownCheckResult {
  cooldownHours: number;
  tickerConflict: DeployCooldownConflict | null;
  nameConflict: DeployCooldownConflict | null;
  tickerReserved: boolean;
  nameReserved: boolean;
  reservedTickerMessage: string | null;
  reservedNameMessage: string | null;
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || res.statusText || 'Request failed');
  }
  return data;
}

export async function fetchDeployments(limit = 50, offset = 0): Promise<Deployment[]> {
  const res = await fetch(`${API_BASE}/api/deployments?limit=${limit}&offset=${offset}`);
  const data = await parseJson<{ deployments: Deployment[] }>(res);
  return data.deployments ?? [];
}

export async function fetchDeploymentByAddress(tokenAddress: string): Promise<TokenDetail> {
  const addr = tokenAddress.trim();
  const res = await fetch(`${API_BASE}/api/deployments/${addr}`);
  const data = await parseJson<{ deployment: TokenDetail }>(res);
  return data.deployment;
}

export async function fetchMyDeployments(
  token: string,
  walletAddress?: string,
): Promise<Deployment[]> {
  const params = new URLSearchParams({ limit: '50', offset: '0' });
  if (walletAddress) params.set('walletAddress', walletAddress);
  const res = await fetch(`${API_BASE}/api/my-deployments?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<{ deployments: Deployment[] }>(res);
  return data.deployments ?? [];
}

export async function fetchWebDeployConfig(): Promise<WebDeployConfig> {
  const res = await fetch(`${API_BASE}/api/web-deploy-config`);
  return parseJson<WebDeployConfig>(res);
}

export async function checkDeployCooldown(
  symbol?: string,
  name?: string,
): Promise<CooldownCheckResult> {
  const params = new URLSearchParams();
  if (symbol?.trim()) params.set('symbol', symbol.trim().toUpperCase());
  if (name?.trim()) params.set('name', name.trim());
  const res = await fetch(`${API_BASE}/api/deploy-cooldown-check?${params}`);
  return parseJson<CooldownCheckResult>(res);
}

export interface LaunchPayload {
  name: string;
  symbol: string;
  imageUrl?: string;
  websiteUrl?: string;
  xUrl?: string;
  description?: string;
}

export interface DeployPreviewResult {
  rateLimitForcedPlatformFee: boolean;
  notice: string | null;
}

export async function fetchDeployPreview(
  token: string,
): Promise<DeployPreviewResult> {
  const res = await fetch(`${API_BASE}/api/deploy-preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ feeTarget: 'self', chain: 'robinhood' }),
  });
  return parseJson<DeployPreviewResult>(res);
}

export async function deployToken(token: string, payload: LaunchPayload): Promise<DeployResult> {
  const res = await fetch(`${API_BASE}/api/deploy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      feeTarget: 'self',
      chain: 'robinhood',
    }),
  });

  const data = (await res.json()) as DeployResult & {
    error?: string;
    conflict?: DeployCooldownConflict;
  };

  if (!res.ok) {
    throw new DeployApiError(data.error || res.statusText || 'Launch failed', data.conflict);
  }

  return data;
}
