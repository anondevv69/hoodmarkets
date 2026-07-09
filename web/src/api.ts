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
  communityLaunch?: CommunityLaunchLockConflict;

  constructor(
    message: string,
    conflict?: DeployCooldownConflict,
    communityLaunch?: CommunityLaunchLockConflict,
  ) {
    super(message);
    this.name = 'DeployApiError';
    this.conflict = conflict;
    this.communityLaunch = communityLaunch;
  }
}

/** Wallet tx hash returned but POST /api/deploy complete failed — may still succeed if chain receipt is ok. */
export class WalletDeployCompleteError extends Error {
  transactionHash: string;

  constructor(message: string, transactionHash: string) {
    super(message);
    this.name = 'WalletDeployCompleteError';
    this.transactionHash = transactionHash;
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
  tokenBannerUrl?: string;
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
  /** Launches by this catalog deployer id (wallet / Privy / social id). */
  deployerDeploymentCount?: number;
  /** X @handle who requested the launch (Bankr X agent or native X). */
  requesterXUsername?: string;
  /** Total hood.markets launches attributed to that X @handle. */
  requesterXLaunchCount?: number;
  /** Wallet that initiated the deploy when known (agent or Privy). */
  deployerWalletAddress?: string;
  /** Catalog rows where this fee wallet receives fees (including this row). */
  feeRecipientDeploymentCount?: number;
  poolId?: string;
  factoryAddress?: string;
  /** Catalog block number — scopes fraction transfer scan. */
  blockNumber?: string;
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
  /** Max launches per Eastern day where you assign fees to someone else (0 = unlimited). */
  maxOtherFeeDeploysPerEasternDay: number;
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
  initialBuyRecommendedEth: string;
  initialBuyPresetsEth: string[];
  walletDeployEnabled: boolean;
  feeClaimContracts?: {
    liquidLpLocker?: string;
    feeLocker?: string;
    weth?: string;
  };
}

export interface DeployResult {
  ok: boolean;
  tokenAddress: string;
  transactionHash: string;
  feeWallet: string;
  imageUrl?: string;
  links?: Record<string, string>;
}

export interface CommunityLaunchLockConflict {
  kind: 'ticker' | 'name';
  roundId: number;
  tokenName: string;
  tokenSymbol: string;
  status: string;
  expiresAt: string;
  shareUrl: string;
}

export interface CooldownCheckResult {
  cooldownHours: number;
  tickerConflict: DeployCooldownConflict | null;
  nameConflict: DeployCooldownConflict | null;
  communityLaunchConflict: CommunityLaunchLockConflict | null;
  communityLaunchMessage: string | null;
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
  const page = await fetchDeploymentsPage(limit, offset);
  return page.deployments;
}

export async function fetchDeploymentsPage(
  limit = 50,
  offset = 0,
): Promise<{ deployments: Deployment[]; total: number }> {
  const res = await fetch(`${API_BASE}/api/deployments?limit=${limit}&offset=${offset}`);
  const data = await parseJson<{ deployments: Deployment[]; total?: number }>(res);
  const deployments = data.deployments ?? [];
  const total =
    typeof data.total === 'number' && Number.isFinite(data.total)
      ? data.total
      : deployments.length;
  return { deployments, total };
}

export type ExploreSort = 'mcap' | 'volume' | 'launch' | 'lastTrade';
export type ExploreFilter = 'all' | 'live' | 'new';

export interface ExploreTokenStats {
  volume24hUsd: number;
  mcapUsd: number;
  liquidityUsd: number;
  change24hPct: number | null;
  txnsH24: number;
  priceUsd: number | null;
  dexscreenerUrl: string | null;
  lastTradeAt: string | null;
  statsUpdatedAt: string | null;
}

export interface ExploreFeedItem {
  deployment: Deployment;
  stats: ExploreTokenStats;
}

export interface ExplorePlatformStats {
  tokensLaunched: number;
  volume24hUsd: number;
  liveCount: number;
  statsUpdatedAt: string | null;
}

export async function fetchExplorePage(params: {
  sort?: ExploreSort;
  filter?: ExploreFilter;
  q?: string;
  limit?: number;
  offset?: number;
  minLiquidityUsd?: number;
}): Promise<{
  total: number;
  sort: ExploreSort;
  filter: ExploreFilter;
  tokens: ExploreFeedItem[];
}> {
  const qs = new URLSearchParams();
  if (params.sort) qs.set('sort', params.sort);
  if (params.filter && params.filter !== 'all') qs.set('filter', params.filter);
  if (params.q?.trim()) qs.set('q', params.q.trim());
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  if (params.minLiquidityUsd != null && params.minLiquidityUsd > 0) {
    qs.set('minLiquidity', String(params.minLiquidityUsd));
  }
  const res = await fetch(`${API_BASE}/api/explore?${qs}`);
  return parseJson(res);
}

export async function fetchExploreStats(): Promise<ExplorePlatformStats> {
  const res = await fetch(`${API_BASE}/api/explore/stats`);
  const data = await parseJson<{ stats: ExplorePlatformStats }>(res);
  return data.stats;
}

export interface TokenMarketStats {
  volume24hUsd: number;
  mcapUsd: number;
  liquidityUsd: number;
  change24hPct: number | null;
  txnsH24: number;
  priceUsd: number | null;
  dexscreenerUrl: string | null;
  lastTradeAt: string | null;
  updatedAt: string;
}

export async function fetchTokenMarketStats(
  tokenAddress: string,
): Promise<TokenMarketStats | null> {
  const res = await fetch(
    `${API_BASE}/api/tokens/${encodeURIComponent(tokenAddress)}/market-stats`,
  );
  if (res.status === 404) return null;
  const data = await parseJson<{ stats: TokenMarketStats }>(res);
  return data.stats ?? null;
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

export interface DeployerProfileResponse {
  platform: 'x';
  xUsername: string;
  launchCount: number;
  profileUrl: string;
  deployments: Deployment[];
}

export interface LinkedAccountsResponse {
  xHandle: string | null;
  xLinked: boolean;
  bankrWallet: string | null;
  bankrLinked: boolean;
  bankrVerified?: boolean;
  telegramLinked?: boolean;
  telegramStatus?: 'coming_soon';
}

export interface MyDeployerProfileResponse {
  xUsername: string | null;
  xHandle: string | null;
  xLinked: boolean;
  /** @deprecated Always false until X OAuth login ships. */
  xVerified: boolean;
  xLaunchCount: number;
  bankrWallet: string | null;
  bankrLinked: boolean;
  bankrVerified?: boolean;
  bankrLaunchCount: number;
  walletLaunchCount: number;
  totalLaunchCount: number;
  publicProfileUrl: string | null;
  deployments: Deployment[];
  linkedAccounts?: LinkedAccountsResponse;
}

export async function fetchDeployerProfileByX(
  username: string,
  limit = 50,
): Promise<DeployerProfileResponse> {
  const handle = username.trim().replace(/^@/, '');
  const res = await fetch(
    `${API_BASE}/api/deployer-profile/x/${encodeURIComponent(handle)}?limit=${limit}`,
  );
  return parseJson<DeployerProfileResponse>(res);
}

export interface WalletProfileResponse {
  platform: 'wallet';
  walletAddress: string;
  feeRecipientTokenCount: number;
  initiatedLaunchCount: number;
  profileUrl: string;
  deployments: Deployment[];
  initiatedDeployments: Deployment[];
  linkedAccounts?: LinkedAccountsResponse;
  xHandle?: string | null;
  xLinked?: boolean;
  bankrWallet?: string | null;
  bankrLinked?: boolean;
}

export async function fetchWalletProfile(walletAddress: string): Promise<WalletProfileResponse> {
  const res = await fetch(
    `${API_BASE}/api/deployer-profile/wallet/${encodeURIComponent(walletAddress.trim())}`,
  );
  return parseJson<WalletProfileResponse>(res);
}

export async function fetchMyDeployerProfile(
  token: string,
  walletAddress?: string,
): Promise<MyDeployerProfileResponse> {
  const params = new URLSearchParams();
  if (walletAddress) params.set('walletAddress', walletAddress);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/api/my-deployer-profile${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<MyDeployerProfileResponse>(res);
}

export interface LinkBankrChallenge {
  message: string;
  expiresAtMs: number;
  walletAddress: string;
}

export async function fetchLinkBankrChallenge(
  token: string,
  walletAddress: string,
): Promise<LinkBankrChallenge> {
  const res = await fetch(`${API_BASE}/api/my-profile/link-bankr/challenge`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletAddress }),
  });
  return parseJson<LinkBankrChallenge>(res);
}

export async function linkBankrWallet(
  token: string,
  input: { walletAddress: string; signature: string; expiresAtMs: number },
): Promise<{ ok: boolean; bankrWallet: string }> {
  const res = await fetch(`${API_BASE}/api/my-profile/link-bankr`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function unlinkBankrWallet(token: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/my-profile/link-bankr`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(res);
}

export interface TokenSpacePost {
  id: number;
  tokenAddress: string;
  walletAddress: string;
  body: string;
  createdAt: string;
}

export async function fetchTokenSpacePosts(tokenAddress: string): Promise<TokenSpacePost[]> {
  const res = await fetch(
    `${API_BASE}/api/token-spaces/${encodeURIComponent(tokenAddress)}/posts`,
  );
  const data = await parseJson<{ posts: TokenSpacePost[] }>(res);
  return data.posts;
}

export async function fetchTokenSpaceHolderStatus(
  tokenAddress: string,
  walletAddress: string,
): Promise<{ holds: boolean; balance: string }> {
  const params = new URLSearchParams({ wallet: walletAddress });
  const res = await fetch(
    `${API_BASE}/api/token-spaces/${encodeURIComponent(tokenAddress)}/holder?${params}`,
  );
  return parseJson(res);
}

export async function postTokenSpaceComment(
  token: string,
  tokenAddress: string,
  walletAddress: string,
  body: string,
): Promise<TokenSpacePost> {
  const res = await fetch(`${API_BASE}/api/token-spaces/${encodeURIComponent(tokenAddress)}/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletAddress, body }),
  });
  const data = await parseJson<{ post: TokenSpacePost }>(res);
  return data.post;
}

export type TokenPageAdminRole = 'top_share_holder' | 'deployer' | 'fee_recipient';

export interface TokenDexBrandingResponse {
  tokenAddress: string;
  catalogImageUrl: string | null;
  catalogBannerUrl: string | null;
  displayImageUrl: string | null;
  displayBannerUrl: string | null;
  isAdmin: boolean;
  dex: {
    enhancedInfoPaid: boolean;
    enhancedInfoStatus: string | null;
    iconUrl: string | null;
    bannerUrl: string | null;
    dexUrl: string | null;
  };
  admin: {
    adminWallet: string;
    adminRole: TokenPageAdminRole;
    topShareHolder: string | null;
    topShareCount: number | null;
    deployerWallet: string | null;
    feeRecipientAddress: string;
  };
}

export async function fetchTokenDexBranding(
  tokenAddress: string,
  walletAddress?: string,
): Promise<TokenDexBrandingResponse> {
  const params = new URLSearchParams();
  if (walletAddress?.trim()) params.set('wallet', walletAddress.trim());
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE}/api/tokens/${encodeURIComponent(tokenAddress)}/dex-branding${qs ? `?${qs}` : ''}`,
  );
  return parseJson(res);
}

export async function importTokenDexBranding(
  accessToken: string,
  tokenAddress: string,
  walletAddress: string,
): Promise<{ ok: boolean; token?: Deployment }> {
  const res = await fetch(
    `${API_BASE}/api/tokens/${encodeURIComponent(tokenAddress)}/import-dex-branding`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress }),
    },
  );
  return parseJson(res);
}

export type CustomSocialLink = { title: string; url: string };

export interface TokenPageProfile {
  tokenAddress: string;
  description: string;
  websiteUrl: string;
  xUrl: string;
  telegramUrl: string;
  discordUrl: string;
  githubUrl: string;
  customLinks: CustomSocialLink[];
  catalogImageUrl: string | null;
  catalogBannerUrl: string | null;
  profileImageUrl: string | null;
  profileBannerUrl: string | null;
  displayImageUrl: string | null;
  displayBannerUrl: string | null;
  useDexIcon: boolean;
  useDexBanner: boolean;
  useLaunchImage: boolean;
  useDexLinks: boolean;
  stored: {
    description: string;
    websiteUrl: string;
    xUrl: string;
    telegramUrl: string;
    discordUrl: string;
    githubUrl: string;
    customLinks: CustomSocialLink[];
  };
  dexLinks: {
    websiteUrl: string;
    xUrl: string;
    telegramUrl: string;
    discordUrl: string;
    githubUrl: string;
    customLinks: CustomSocialLink[];
  };
  catalog: {
    description: string;
    websiteUrl: string;
    xUrl: string;
  };
  verified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  canEdit: boolean;
  canVerify: boolean;
  isAdmin: boolean;
  adminRole: TokenPageAdminRole | null;
  dex: TokenDexBrandingResponse['dex'];
}

export async function fetchTokenPageProfile(
  tokenAddress: string,
  walletAddress?: string,
): Promise<TokenPageProfile> {
  const params = new URLSearchParams();
  if (walletAddress?.trim()) params.set('wallet', walletAddress.trim());
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE}/api/tokens/${encodeURIComponent(tokenAddress)}/profile${qs ? `?${qs}` : ''}`,
  );
  const data = await parseJson<{ profile: TokenPageProfile }>(res);
  return data.profile;
}

export type TokenPageProfilePatch = {
  description?: string;
  websiteUrl?: string;
  xUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
  githubUrl?: string;
  customLinks?: CustomSocialLink[];
  imageUrl?: string;
  bannerUrl?: string;
  useDexIcon?: boolean;
  useDexBanner?: boolean;
  useLaunchImage?: boolean;
  useDexLinks?: boolean;
  importDexBranding?: boolean;
};

export async function updateTokenPageProfile(
  accessToken: string,
  tokenAddress: string,
  walletAddress: string,
  patch: TokenPageProfilePatch,
): Promise<TokenPageProfile> {
  const res = await fetch(`${API_BASE}/api/tokens/${encodeURIComponent(tokenAddress)}/profile`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletAddress, ...patch }),
  });
  const data = await parseJson<{ profile: TokenPageProfile }>(res);
  return data.profile;
}

export async function verifyTokenPage(
  accessToken: string,
  tokenAddress: string,
  walletAddress: string,
): Promise<{ profile: TokenPageProfile; replyHint: string }> {
  const res = await fetch(`${API_BASE}/api/tokens/${encodeURIComponent(tokenAddress)}/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletAddress }),
  });
  return parseJson(res);
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

import type { WalletDeployPrepare } from './lib/walletDeploy';
import { assertV3WalletDeployPrepare, signWalletDeployToken } from './lib/walletDeploy';
import { ensureRobinhoodChainInWallet } from './lib/ensureRobinhoodChain';
import { createPublicClient, http, type Hash } from 'viem';
import { robinhood, txUrl } from './chain';

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
  /** Optional Holder NFT shares escrowed for automatic first-buyer rewards (0–1000). */
  buyerRewardShareCount?: number | string;
  /** `self` = your Privy wallet (default). `other` = fees go to pasted wallet / @handle. */
  feeTarget?: 'self' | 'other';
  recipientPaste?: string;
  recipientAddress?: string;
}

export type { WalletDeployPrepare } from './lib/walletDeploy';

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
  opts?: { timeoutMs?: number },
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
    signal: opts?.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  });

  const data = (await res.json()) as DeployResult &
    WalletDeployPrepare & {
      error?: string;
      conflict?: DeployCooldownConflict;
      communityLaunch?: CommunityLaunchLockConflict;
    };

  if (!res.ok) {
    throw new DeployApiError(
      data.error || res.statusText || 'Launch failed',
      data.conflict,
      data.communityLaunch,
    );
  }

  return data;
}

const PENDING_WALLET_DEPLOY_KEY = 'hoodmarkets_wallet_deploy_pending';

type PendingWalletDeploy = {
  payload: LaunchPayload;
  transactionHash: string;
  deploymentConfig: WalletDeployPrepare['deploymentConfig'];
  imageUrl?: string;
};

function savePendingWalletDeploy(pending: PendingWalletDeploy): void {
  try {
    sessionStorage.setItem(PENDING_WALLET_DEPLOY_KEY, JSON.stringify(pending));
  } catch {
    // ignore quota / private mode
  }
}

export function loadPendingWalletDeploy(): PendingWalletDeploy | null {
  try {
    const raw = sessionStorage.getItem(PENDING_WALLET_DEPLOY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingWalletDeploy;
  } catch {
    return null;
  }
}

function clearPendingWalletDeploy(): void {
  try {
    sessionStorage.removeItem(PENDING_WALLET_DEPLOY_KEY);
  } catch {
    // ignore
  }
}

export async function retryPendingWalletDeployComplete(token: string): Promise<DeployResult> {
  const pending = loadPendingWalletDeploy();
  if (!pending) {
    throw new Error('No pending launch to finalize.');
  }

  const complete = await postDeploy(token, {
    ...pending.payload,
    walletDeployPhase: 'complete',
    transactionHash: pending.transactionHash,
    deploymentConfig: pending.deploymentConfig,
  });

  clearPendingWalletDeploy();

  return {
    ok: complete.ok,
    tokenAddress: complete.tokenAddress,
    transactionHash: complete.transactionHash,
    feeWallet: complete.feeWallet,
    imageUrl: complete.imageUrl ?? pending.imageUrl,
    links: complete.links,
  };
}

export type DeployProgress = 'prepare' | 'wallet' | 'confirm' | 'finalize';

export async function deployToken(
  token: string,
  payload: LaunchPayload,
  wallet?: {
    address: string;
    getEthereumProvider: () => Promise<unknown>;
  },
  opts?: { onProgress?: (phase: DeployProgress) => void },
): Promise<DeployResult> {
  const initialBuy = payload.initialBuyEth?.trim() ?? '';
  const useWalletDeploy = initialBuy !== '' && initialBuy !== '0';

  if (useWalletDeploy) {
    if (!wallet?.address) {
      throw new Error('Connect a wallet to include your initial buy in the launch transaction.');
    }

    opts?.onProgress?.('prepare');
    let prepare: DeployResult & WalletDeployPrepare;
    try {
      prepare = await postDeploy(
        token,
        {
          ...payload,
          initialBuyEth: initialBuy,
          walletDeployPhase: 'prepare',
        },
        { timeoutMs: 120_000 },
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new Error(
          'Launch prepare timed out waiting on the API. Try again in a moment — your wallet opens after the server finishes building the deploy.',
        );
      }
      throw err;
    }

    if (prepare.mode !== 'wallet') {
      throw new Error(
        'Server did not return wallet deploy preparation. Connect your wallet and ensure it has enough ETH for the pool seed plus gas.',
      );
    }

    const walletPrepare = prepare as WalletDeployPrepare;
    assertV3WalletDeployPrepare(walletPrepare);

    opts?.onProgress?.('wallet');
    const provider = await wallet.getEthereumProvider();
    await ensureRobinhoodChainInWallet(
      provider as Parameters<typeof ensureRobinhoodChainInWallet>[0],
    );

    const txHash = await signWalletDeployToken({
      prepare: walletPrepare,
      walletProvider: provider as Parameters<typeof signWalletDeployToken>[0]['walletProvider'],
      account: wallet.address as `0x${string}`,
    });

    opts?.onProgress?.('confirm');
    const receipt = await createPublicClient({
      chain: robinhood,
      transport: http(),
    }).waitForTransactionReceipt({ hash: txHash as Hash });

    if (receipt.status !== 'success') {
      clearPendingWalletDeploy();
      throw new Error(
        `Launch transaction reverted on-chain (no token was created). Hard-refresh the page and launch again with a new name/ticker. ${txUrl(txHash)}`,
      );
    }

    try {
      opts?.onProgress?.('finalize');
      const complete = await postDeploy(token, {
        ...payload,
        initialBuyEth: initialBuy,
        walletDeployPhase: 'complete',
        transactionHash: txHash,
        deploymentConfig: prepare.deploymentConfig,
      });

      clearPendingWalletDeploy();

      return {
        ok: complete.ok,
        tokenAddress: complete.tokenAddress,
        transactionHash: complete.transactionHash,
        feeWallet: complete.feeWallet,
        imageUrl: complete.imageUrl ?? prepare.imageUrl,
        links: complete.links,
      };
    } catch (err) {
      savePendingWalletDeploy({
        payload,
        transactionHash: txHash,
        deploymentConfig: prepare.deploymentConfig,
        imageUrl: prepare.imageUrl,
      });
      const message =
        err instanceof DeployApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Launch failed';
      const canFinalize =
        !/reverted on-chain/i.test(message) && !/transaction reverted/i.test(message);
      if (!canFinalize) {
        clearPendingWalletDeploy();
        throw new Error(message);
      }
      throw new WalletDeployCompleteError(message, txHash);
    }
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
  feeRecipientAddress?: string;
  error?: string;
}

export interface TokenFeeStatus {
  feeRecipientAddress: string;
  platformFees: boolean;
  feeModel: 'v3' | 'v4';
  pendingWethWei: string;
  pendingWethHuman: string;
  feeClaimedAt?: string;
  feeClaimTxHash?: string;
}

export async function fetchTokenFeeStatus(tokenAddress: string): Promise<TokenFeeStatus> {
  const res = await fetch(`${API_BASE}/api/deployments/${tokenAddress}/fee-status`);
  return parseJson<TokenFeeStatus>(res);
}

export async function collectPoolFeesPublic(tokenAddress: string): Promise<ClaimFeesResult> {
  const res = await fetch(`${API_BASE}/api/deployments/${tokenAddress}/collect-pool-fees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return parseJson<ClaimFeesResult>(res);
}

export async function claimTradingFeesPublic(tokenAddress: string): Promise<ClaimFeesResult> {
  const res = await fetch(`${API_BASE}/api/deployments/${tokenAddress}/claim-fees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return parseJson<ClaimFeesResult>(res);
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

export interface BuyerRewardStatus {
  enabled: boolean;
  cap: number;
  remaining: number;
  issued: number;
  pool: string | null;
}

export interface ProcessBuyerRewardsResult {
  ok: boolean;
  issued: number;
  buyers: string[];
  remaining: number;
  message: string;
  txHashes: string[];
  status: BuyerRewardStatus;
}

export async function fetchBuyerRewardStatus(tokenAddress: string): Promise<BuyerRewardStatus> {
  const res = await fetch(`${API_BASE}/api/deployments/${tokenAddress}/buyer-rewards-status`);
  return parseJson<BuyerRewardStatus>(res);
}

export async function processBuyerRewards(tokenAddress: string): Promise<ProcessBuyerRewardsResult> {
  const res = await fetch(`${API_BASE}/api/deployments/${tokenAddress}/process-buyer-rewards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return parseJson<ProcessBuyerRewardsResult>(res);
}

const COMMUNITY_LAUNCH_API = `${API_BASE}/api/community-launch`;

export interface CommunityLaunchSummary {
  id: string;
  status: string;
  chain: string;
  chainId: number;
  tokenName: string;
  tokenSymbol: string;
  description: string;
  imageUrl?: string;
  websiteUrl?: string;
  tweetUrl?: string;
  shareSupply: number;
  targetRaiseEth: string;
  targetRaiseWei: string;
  raisedEth: string;
  raisedWei: string;
  remainingEth: string;
  remainingWei: string;
  raiseProgressPct: number;
  contributionPerSlotEth: string | null;
  supporterSlots: number | null;
  expiresAt: string;
  escrowWallet: string | null;
  shareUrl: string;
  starterWallet: string | null;
  tokenAddress: string | null;
  orders?: CommunityLaunchOrderSummary[];
  finalResult: {
    tokenAddress: string;
    deployTxHash: string;
    airdropTxHash?: string;
    initialBuyEth?: string;
  } | null;
  agentParticipation: {
    fixedUnitsPerWallet: boolean;
    supportersJoined: number | null;
    supportersRemaining: number | null;
  };
  /** @deprecated use raisedEth / targetRaiseEth */
  publicCap?: number;
  soldUnits?: number;
  remainingUnits?: number;
  unitPriceEth?: string;
}

export interface CommunityLaunchOrderSummary {
  wallet: string;
  contributionEth: string;
  contributionWei: string;
  estimatedShares: number;
  ownershipPct: number;
  status: string;
}

/** @deprecated use CommunityLaunchSummary */
export type PetitionSummary = CommunityLaunchSummary;

async function communityLaunchJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || res.statusText || 'Community Launch API error',
    );
  }
  return data as T;
}

export async function fetchCommunityLaunchConfig(): Promise<{
  ok: boolean;
  config: { enabled: boolean };
}> {
  const res = await fetch(`${COMMUNITY_LAUNCH_API}/config`);
  return communityLaunchJson(res);
}

export async function fetchCommunityLaunchList(): Promise<{
  ok: boolean;
  petitions: CommunityLaunchSummary[];
}> {
  const res = await fetch(`${COMMUNITY_LAUNCH_API}/list`);
  return communityLaunchJson(res);
}

export async function fetchCommunityLaunchPreflight(params: {
  tokenName: string;
  tokenSymbol: string;
  targetRaiseEth?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  deployCooldown?: {
    kind: 'ticker' | 'name';
    existing?: { tokenName: string; tokenSymbol: string; tokenAddress: string };
  };
}> {
  const q = new URLSearchParams({
    tokenName: params.tokenName.trim(),
    tokenSymbol: params.tokenSymbol.trim().replace(/^\$/, ''),
  });
  if (params.targetRaiseEth?.trim()) q.set('targetRaiseEth', params.targetRaiseEth.trim());
  const res = await fetch(`${COMMUNITY_LAUNCH_API}/preflight?${q}`);
  return communityLaunchJson(res);
}

export async function fetchCommunityLaunchStatus(
  id: string,
): Promise<{ ok: boolean; petition: CommunityLaunchSummary }> {
  const res = await fetch(`${COMMUNITY_LAUNCH_API}/status?id=${encodeURIComponent(id)}`);
  return communityLaunchJson(res);
}

export async function createCommunityLaunch(body: {
  tokenName: string;
  tokenSymbol: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  xUrl?: string;
  starterWallet?: string;
  targetRaiseEth: string;
  supporterSlots?: number;
  hoodClaimOptIn?: boolean;
}): Promise<{ ok: boolean; petition: CommunityLaunchSummary }> {
  const res = await fetch(`${COMMUNITY_LAUNCH_API}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return communityLaunchJson(res);
}

export async function prepareCommunityLaunchDeposit(params: {
  id: string;
  wallet: string;
  contributionEth: string;
}): Promise<{
  ok: boolean;
  nextStep: { to: string; value: string; data: string; chainId: number };
  deposit: { totalEth: string; contributionEth: string };
}> {
  const q = new URLSearchParams({
    id: params.id,
    wallet: params.wallet,
    contributionEth: params.contributionEth,
  });
  const res = await fetch(`${COMMUNITY_LAUNCH_API}/prepare-deposit?${q}`);
  return communityLaunchJson(res);
}

export async function confirmCommunityLaunchDeposit(body: {
  id: string;
  wallet: string;
  contributionEth: string;
  signature: string;
}): Promise<{ ok: boolean; petition: CommunityLaunchSummary }> {
  const res = await fetch(`${COMMUNITY_LAUNCH_API}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return communityLaunchJson(res);
}

export async function refundCommunityLaunch(body: {
  id: string;
  wallet: string;
}): Promise<{ ok: boolean; refundTxHash: string; petition: CommunityLaunchSummary }> {
  const res = await fetch(`${COMMUNITY_LAUNCH_API}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return communityLaunchJson(res);
}

export async function cancelCommunityLaunch(body: {
  id: string;
  wallet: string;
}): Promise<{
  ok: boolean;
  refunds: Array<{ wallet: string; refundTxHash: string }>;
  petition: CommunityLaunchSummary;
}> {
  const res = await fetch(`${COMMUNITY_LAUNCH_API}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return communityLaunchJson(res);
}

/** @deprecated use fetchCommunityLaunchConfig */
export const fetchPetitionConfig = fetchCommunityLaunchConfig;
/** @deprecated use fetchCommunityLaunchList */
export const fetchPetitionList = fetchCommunityLaunchList;
/** @deprecated use fetchCommunityLaunchStatus */
export const fetchPetitionStatus = fetchCommunityLaunchStatus;
/** @deprecated use createCommunityLaunch */
export const createPetition = createCommunityLaunch;
/** @deprecated use prepareCommunityLaunchDeposit */
export const preparePetitionDeposit = prepareCommunityLaunchDeposit;
/** @deprecated use confirmCommunityLaunchDeposit */
export const confirmPetitionDeposit = confirmCommunityLaunchDeposit;
