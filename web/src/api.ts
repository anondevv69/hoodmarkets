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

export const API_BASE = (() => {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000';
  }
  return 'https://api.hood.markets';
})();

export interface Deployment {
  id: number;
  createdAt: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenImageUrl?: string;
  tokenWebsiteUrl?: string;
  tokenXUrl?: string;
  tokenDescription?: string;
  transactionHash: string;
  feeRecipientAddress: string;
  feeRecipientLabel?: string;
  feeToSelf?: boolean;
  deployerLabel: string;
  chain: string;
  clientKind?: string;
  agentMetadata?: string;
  /** Original post URL (X tweet, Warpcast cast, etc.) when stored at deploy. */
  sourceUrl?: string;
}

export type TokenDetail = Deployment & {
  poolId?: string;
  platform?: string;
  deployerId?: string;
};

export interface WebDeployConfig {
  chainId: number;
  deployDefaultChain: string;
  strictDeployRateLimits: boolean;
  globalTickerCooldownHours: number;
  maxSelfFeeDeploysPer24h: number;
  deployRateLimitHours: number;
  /** Max tokens that can pay fees to the same wallet per Eastern day (0 = unlimited). */
  maxFeeRecipientDeploysPerEasternDay: number;
  /** Rolling cap on third-party fee assigns to the same wallet (0 = off). */
  maxThirdPartyFeeToWalletPer24h: number;
  thirdPartyFeeDeployEnabled: boolean;
  platformFeeBps: number;
  platformFeePercent: number;
  /** HoodMarkets V3 locker embeds 5% to platform wallet (not configurable per token). */
  v3PlatformFeePercent: number;
  defaultLaunchMode: 'simple' | 'pro';
  v3LaunchEnabled: boolean;
  proLaunchEnabled: boolean;
  imageUploadEnabled: boolean;
  /** WETH seeded at launch from hood.markets launcher wallet (`DEPLOY_BOND_ETH`) when you skip your buy. */
  platformSubsidizedInitialBuyEth: number;
  initialBuyMinEth: string;
  initialBuyMaxEth: string;
  initialBuyDefaultEth: string;
  walletDeployEnabled: boolean;
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
  /** ETH bundled into deployToken via Univ4EthDevBuy (`0` = server-only deploy). */
  initialBuyEth?: string;
  /** `simple` = Uniswap V3 (DexScreener). `pro` = HoodMarkets V4 hooks. */
  launchMode?: 'simple' | 'pro';
  /** `self` = your Privy wallet (default). `other` = fees go to pasted wallet / @handle. */
  feeTarget?: 'self' | 'other';
  recipientPaste?: string;
  recipientAddress?: string;
}

export type WalletDeployPrepare = {
  mode: 'wallet';
  factory: `0x${string}`;
  deploymentConfig: import('./lib/deploymentConfigJson').SerializedDeploymentConfig;
  msgValueWei: string;
  gas: string;
  chainId: number;
  imageUrl: string;
};

export interface DeployPreviewResult {
  rateLimitForcedPlatformFee: boolean;
  notice: string | null;
}

function deployFeeBody(payload: Pick<LaunchPayload, 'feeTarget' | 'recipientPaste' | 'recipientAddress'>) {
  const feeTarget = payload.feeTarget === 'other' ? 'other' : 'self';
  if (feeTarget === 'self') {
    return { feeTarget: 'self' as const, chain: 'robinhood' as const };
  }
  const paste = payload.recipientPaste?.trim();
  const addr = payload.recipientAddress?.trim();
  return {
    feeTarget: 'other' as const,
    chain: 'robinhood' as const,
    ...(paste ? { recipientPaste: paste } : {}),
    ...(addr ? { recipientAddress: addr } : {}),
  };
}

export async function fetchDeployPreview(
  token: string,
  payload: Pick<LaunchPayload, 'feeTarget' | 'recipientPaste' | 'recipientAddress'> = {},
): Promise<DeployPreviewResult> {
  const res = await fetch(`${API_BASE}/api/deploy-preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(deployFeeBody(payload)),
  });
  return parseJson<DeployPreviewResult>(res);
}

async function postDeploy(
  token: string,
  payload: LaunchPayload & {
    walletDeployPhase?: 'prepare' | 'complete';
    transactionHash?: string;
    deploymentConfig?: WalletDeployPrepare['deploymentConfig'];
  },
): Promise<DeployResult & WalletDeployPrepare> {
  const res = await fetch(`${API_BASE}/api/deploy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      ...deployFeeBody(payload),
    }),
  });

  const data = (await res.json()) as DeployResult &
    WalletDeployPrepare & {
      error?: string;
      conflict?: DeployCooldownConflict;
    };

  if (!res.ok) {
    throw new DeployApiError(data.error || res.statusText || 'Launch failed', data.conflict);
  }

  return data;
}

export async function deployToken(
  token: string,
  payload: LaunchPayload,
  wallet?: {
    address: string;
    getEthereumProvider: () => Promise<unknown>;
  },
): Promise<DeployResult> {
  const initialBuy = payload.initialBuyEth?.trim() ?? '';
  const useWalletDeploy = initialBuy !== '' && initialBuy !== '0';

  if (useWalletDeploy) {
    if (!wallet?.address) {
      throw new Error('Connect a wallet to include your initial buy in the launch transaction.');
    }

    const prepare = await postDeploy(token, {
      ...payload,
      initialBuyEth: initialBuy,
      walletDeployPhase: 'prepare',
    });

    if (prepare.mode !== 'wallet') {
      throw new Error('Server did not return wallet deploy preparation.');
    }

    const provider = await wallet.getEthereumProvider();
    const { signWalletDeployToken } = await import('./lib/walletDeploy');
    const { ensureRobinhoodChainInWallet } = await import('./lib/ensureRobinhoodChain');
    await ensureRobinhoodChainInWallet(
      provider as Parameters<typeof ensureRobinhoodChainInWallet>[0],
    );

    const txHash = await signWalletDeployToken({
      prepare,
      walletProvider: provider as Parameters<typeof signWalletDeployToken>[0]['walletProvider'],
      account: wallet.address as `0x${string}`,
    });

    const complete = await postDeploy(token, {
      ...payload,
      initialBuyEth: initialBuy,
      walletDeployPhase: 'complete',
      transactionHash: txHash,
      deploymentConfig: prepare.deploymentConfig,
    });

    return {
      ok: complete.ok,
      tokenAddress: complete.tokenAddress,
      transactionHash: complete.transactionHash,
      feeWallet: complete.feeWallet,
      imageUrl: complete.imageUrl ?? prepare.imageUrl,
      links: complete.links,
    };
  }

  const out = await postDeploy(token, payload);
  return {
    ok: out.ok,
    tokenAddress: out.tokenAddress,
    transactionHash: out.transactionHash,
    feeWallet: out.feeWallet,
    imageUrl: out.imageUrl,
    links: out.links,
  };
}

export interface ClaimFeesResult {
  ok: boolean;
  message: string;
  txHash?: string;
  basescanUrl?: string;
  feeAmountHuman?: string;
}

export async function collectPoolFees(
  authToken: string,
  tokenAddress: string,
  walletAddress?: string,
): Promise<ClaimFeesResult> {
  const res = await fetch(`${API_BASE}/api/my-deployments/collect-pool-fees`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tokenAddress, walletAddress }),
  });
  return parseJson<ClaimFeesResult>(res);
}

export async function claimTradingFees(
  authToken: string,
  tokenAddress: string,
  walletAddress?: string,
): Promise<ClaimFeesResult> {
  const res = await fetch(`${API_BASE}/api/my-deployments/claim`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tokenAddress, walletAddress }),
  });
  return parseJson<ClaimFeesResult>(res);
}
