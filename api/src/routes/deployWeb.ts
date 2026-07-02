import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import { createPublicClient, formatEther, http, getAddress, type Address } from 'viem';
import { robinhood } from '../lib/robinhoodChain.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { LiquidDeployer } from '../deployer.js';
import type { NeynarClient } from '../neynar.js';
import { verifyPrivyBearerToken } from '../lib/privyAccessToken.js';
import { parseRecipientPaste } from '../lib/recipientPaste.js';
import { resolveWebFeeRecipient } from '../lib/webFeeRecipient.js';
import {
  fetchPrivyUserRecordById,
  formatWebDeployInitiatorAttribution,
} from '../lib/privy.js';
import { checkAndRecordDeploy, hashDeployRequest, releaseDeployAttempt, type DeployRequest } from '../lib/deployDedup.js';
import { notifyDiscordWebLaunch } from '../lib/discordDebug.js';
import { webDeployCorsHeaders, webDeployCorsHeadersRead } from '../lib/webDeployCors.js';
import {
  DEPLOY_LIMIT_MEME_PROCEED_USER_NOTICE,
  MEME_TOKEN_DESCRIPTION_TAGLINE,
  RATE_LIMIT_FORCED_DEAD_FEE_LABEL,
} from '../lib/memeFeeRecipient.js';
import { applyDeployRateLimitBurn } from '../lib/deployRateLimitBurn.js';
import {
  formatDeployCooldownConflictMessage,
  formatGlobalNameCooldownMessage,
  formatGlobalTickerCooldownMessage,
  getGlobalNameCooldownConflict,
  getGlobalTickerCooldownConflict,
  globalTickerCooldownHours,
  isNameGloballyReserved,
  isTickerGloballyReserved,
  thirdPartyFeeRecipientCooldownErrorOrNull,
} from '../lib/globalTickerCooldown.js';
import {
  deployRateLimitRollingHours,
  maxSelfFeeDeploysPerRollingWindow,
  selfFeeDeployLimitErrorOrNull,
} from '../lib/selfFeeLimit.js';
import { runAfterPriorWebSelfFeeWork } from '../lib/webSelfFeeQueue.js';
import { runAfterPriorWebThirdPartyFeeWork } from '../lib/webThirdPartyFeeQueue.js';
import { readAgentCaptchaToken, verifyAgentCaptchaJwt } from '../lib/agentCaptchaVerify.js';
import { verifyDeploySignature } from '../lib/agentWalletAuth.js';
import {
  buildAgentDeployCommitment,
  verifyAgentDeployCommitment,
} from '../lib/agentDeployCommitment.js';
import { verifyAgentPaymentTransaction } from '../lib/agentDeployPaymentVerify.js';
import {
  webInitialBuyDefaultEth,
} from '../lib/deployBondEnv.js';
import {
  tryReserveAgentPaymentTx,
  releaseAgentPaymentTx,
  listSelfFeeTokensForFeeRecipient,
  listThirdPartyFeeTokensForFeeRecipientRollingHours,
  listDeploymentCatalogByDeployer,
} from '../lib/deploymentCatalog.js';
import {
  isReservedTicker,
  isReservedTokenName,
  reservedNameUserMessage,
  reservedTickerUserMessage,
} from '../lib/reservedTokens.js';
import {
  parseAgentMetadataJson,
  serializeAgentDeployMetadata,
} from '../lib/agentDeployMetadata.js';
import {
  assertEthereumDeployConfigured,
  resolveDeployChain,
} from '../lib/deployChain.js';
import { formatDeployError } from '../lib/formatDeployError.js';
import { imageUploadService } from '../lib/imageUpload.js';
import {
  applyWebDeployRateLimit,
  RATE_LIMIT_FORCED_PLATFORM_FEE_LABEL,
  webDeployRateLimitPlatformNotice,
} from '../lib/webDeployRateLimit.js';

const agentPaymentPublicClient = createPublicClient({
  chain: robinhood,
  transport: http(config.chainRpcUrl),
});

/** HTTP(S) image URL or data:image/*;base64 (for client uploads; max ~2MB). */
function normalizeWebDeployImage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if (t.startsWith('https://') || t.startsWith('http://')) return t;
  if (t.startsWith('data:image/') && t.includes(';base64,')) {
    const maxChars = 2_800_000;
    if (t.length > maxChars) return undefined;
    return t;
  }
  return undefined;
}

function normalizeWebsiteUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return u.toString().slice(0, 512);
  } catch {
    return undefined;
  }
}

/** Accepts https URL or @handle / handle → https://x.com/handle */
function normalizeTokenXUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  let t = raw.trim();
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      if (!/^(x\.com|twitter\.com|www\.x\.com|www\.twitter\.com)$/i.test(u.hostname)) {
        return undefined;
      }
      return u.toString().slice(0, 512);
    } catch {
      return undefined;
    }
  }
  t = t.replace(/^@/, '').replace(/^x\.com\//i, '').replace(/^twitter\.com\//i, '');
  if (!/^[A-Za-z0-9_]{1,15}$/.test(t)) return undefined;
  return `https://x.com/${t}`.slice(0, 512);
}

interface DeployWebBody {
  name?: string;
  symbol?: string;
  imageUrl?: string;
  websiteUrl?: string;
  xUrl?: string;
  description?: string;
  feeTarget?: 'self' | 'other' | 'no_dev' | 'agent_wallet';
  /** Browser-stable id when deploying No Dev without Privy (dedup + abuse tracing). */
  anonymousClientId?: string;
  /** Set to `agent` when the caller is automation (curl, agent) — UI shows an Agent card. */
  clientKind?: string;
  /**
   * With `feeTarget: agent_wallet` — X-Agent-Captcha-JWT header is required.
   * The wallet address is extracted from the CAPTCHA JWT claims (walletAddress field).
   */
  agentCaptchaJwt?: string;
  /** Optional: e.g. `bankr` — stored in catalog + echoed in deploy response. */
  agentProvider?: string;
  /** Optional: where the agent runs, e.g. `cloud`, `user-device`. */
  agentRuntime?: string;
  /** Optional: wallet stack, e.g. `bankr-evm`, `injected`. */
  walletKind?: string;
  /** Optional extra string metadata (merged with the fields above). */
  agentMetadata?: Record<string, unknown>;
  recipientAddress?: string;
  farcasterUsername?: string;
  xUsername?: string;
  githubUsername?: string;
  telegramUsername?: string;
  discordUserId?: string;
  recipientPaste?: string;
  /** `base` (default) or `ethereum` (Ethereum mainnet). Requires `ETHEREUM_DEPLOY_ENABLED=true`. */
  chain?: string;
}

function normalizeAnonymousClientId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length < 8 || t.length > 128) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return null;
  return t;
}

function hasBearerToken(authHeader: string | undefined): boolean {
  return !!authHeader?.startsWith('Bearer ') && authHeader.slice('Bearer '.length).trim().length > 0;
}

type WebDeployPreviewResult = {
  rateLimitForcedPlatformFee: boolean;
  notice: string | null;
};

/**
 * Same auth + fee resolution + `applyDeployRateLimitBurn` as POST /api/deploy, without deploying.
 * Used by the web UI to confirm before launch when the next deploy would route fees to burn.
 */
async function previewWebDeployRateLimit(
  req: Request,
  neynar: NeynarClient,
): Promise<WebDeployPreviewResult> {
  const body = req.body as DeployWebBody;
  const paste =
    typeof body.recipientPaste === 'string' ? parseRecipientPaste(body.recipientPaste) : {};

  const isAgentWalletDeploy = body.feeTarget === 'agent_wallet';

  const feeTarget: 'self' | 'other' | 'no_dev' | 'agent_wallet' =
    body.feeTarget === 'agent_wallet'
      ? 'agent_wallet'
      : body.feeTarget === 'no_dev'
        ? 'no_dev'
        : body.feeTarget === 'other'
          ? 'other'
          : 'self';

  const bearer = hasBearerToken(req.headers.authorization);
  const allowAnonNoDev = feeTarget === 'no_dev' && !bearer;

  if (!allowAnonNoDev && !isAgentWalletDeploy && !config.privy.enabled) {
    throw new Error('Web deploy requires Privy (PRIVY_APP_ID / PRIVY_APP_SECRET).');
  }

  let userId: string;
  let anonymousNoDev = false;
  let agentWalletDeploy = false;
  let agentVerifiedFee: Address | null = null;

  if (isAgentWalletDeploy) {
    const captchaJwt = readAgentCaptchaToken(req.headers as any, body);
    if (!captchaJwt) {
      throw new Error(
        'Agent captcha deploy requires X-Agent-Captcha-JWT header or agentCaptchaJwt in body.',
      );
    }

    let captchaPayload;
    try {
      captchaPayload = await verifyAgentCaptchaJwt(captchaJwt);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(msg);
    }

    const walletFromCaptcha = captchaPayload.walletAddress;
    let agentVerifiedFeeFromCaptcha: Address;
    try {
      agentVerifiedFeeFromCaptcha = getAddress(walletFromCaptcha);
    } catch {
      throw new Error('Invalid walletAddress in CAPTCHA JWT.');
    }

    agentVerifiedFee = agentVerifiedFeeFromCaptcha;
    userId = `agent:${agentVerifiedFee}`;
    agentWalletDeploy = true;
  } else if (allowAnonNoDev) {
    const aid = normalizeAnonymousClientId(body.anonymousClientId);
    if (!aid) {
      throw new Error(
        'No Dev without sign-in requires anonymousClientId (the app generates one in session storage).',
      );
    }
    userId = `web-anon:${aid}`;
    anonymousNoDev = true;
  } else {
    const { userId: uid } = await verifyPrivyBearerToken(req.headers.authorization);
    userId = uid;
  }

  let fee:
    | { kind: 'no_dev' }
    | { kind: 'self'; privyUserId: string; privyUser?: unknown }
    | {
        kind: 'other';
        address?: string;
        farcasterUsername?: string;
        xUsername?: string;
        githubUsername?: string;
        telegramUsername?: string;
        discordUserId?: string;
      };

  if (isAgentWalletDeploy && agentVerifiedFee) {
    fee = { kind: 'other', address: agentVerifiedFee };
  } else if (feeTarget === 'no_dev') {
    fee = { kind: 'no_dev' };
  } else if (feeTarget === 'self') {
    fee = { kind: 'self', privyUserId: userId };
  } else {
    fee = {
      kind: 'other',
      address: body.recipientAddress?.trim() || paste.walletAddress,
      farcasterUsername: body.farcasterUsername?.trim() || paste.farcasterUsername,
      xUsername: body.xUsername?.trim() || paste.xUsername,
      githubUsername: body.githubUsername?.trim() || paste.githubUsername,
      telegramUsername:
        (typeof body.telegramUsername === 'string' ? body.telegramUsername.trim() : undefined) ||
        paste.telegramUsername,
      discordUserId:
        (typeof body.discordUserId === 'string' ? body.discordUserId.trim() : undefined) ||
        paste.discordUserId,
    };
  }

  const resolved = await resolveWebFeeRecipient(neynar, fee);

  if (fee.kind === 'no_dev') {
    return { rateLimitForcedPlatformFee: false, notice: null };
  }

  if (config.webOnlyMode && fee.kind === 'self') {
    const limited = await applyWebDeployRateLimit({
      walletAddress: resolved.walletAddress,
      feeRecipientLabel: resolved.feeRecipientLabel,
      feeToSelf: true,
      deployerId: userId,
      privyUserId: !anonymousNoDev && !agentWalletDeploy ? userId : null,
    });
    return {
      rateLimitForcedPlatformFee: limited.rateLimitForcedPlatformFee,
      notice: limited.rateLimitForcedPlatformFee ? webDeployRateLimitPlatformNotice() : null,
    };
  }

  if (config.strictDeployRateLimits && fee.kind === 'self') {
    const limitErr = await selfFeeDeployLimitErrorOrNull({
      privyUserId: !anonymousNoDev && !agentWalletDeploy ? userId : null,
      platform: 'web',
      deployerId: userId,
    });
    if (limitErr) {
      throw new Error(limitErr);
    }
  }

  const limited = await applyDeployRateLimitBurn({
    walletAddress: resolved.walletAddress,
    feeRecipientLabel: resolved.feeRecipientLabel,
    feeToSelf: fee.kind === 'self',
    platform: 'web',
    deployerId: userId,
    privyUserId: !anonymousNoDev && !agentWalletDeploy ? userId : null,
  });

  return {
    rateLimitForcedPlatformFee: limited.rateLimitForcedBurn,
    notice: limited.rateLimitForcedBurn ? DEPLOY_LIMIT_MEME_PROCEED_USER_NOTICE : null,
  };
}

export function registerWebDeployRoutes(
  app: Express,
  deployer: LiquidDeployer,
  neynar: NeynarClient,
): void {
  app.options('/api/web-deploy-config', (req, res) => {
    const h = webDeployCorsHeadersRead(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(204).end();
  });

  app.get('/api/web-deploy-config', (req: Request, res: Response) => {
    const h = webDeployCorsHeadersRead(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.json({
      ethereumDeployEnabled: config.ethereum.deployEnabled,
      deployDefaultChain: config.deployDefaultChain,
      ethereumVanityAddresses: config.ethereum.clankerVanityAddresses,
      chainId: 4663,
      strictDeployRateLimits: config.strictDeployRateLimits,
      globalTickerCooldownHours: globalTickerCooldownHours(),
      maxSelfFeeDeploysPer24h: maxSelfFeeDeploysPerRollingWindow(),
      deployRateLimitHours: deployRateLimitRollingHours(),
      platformFeeBps: config.platformFeeBps,
      platformFeePercent: Number((config.platformFeeBps / 100).toFixed(2)),
      imageUploadEnabled: imageUploadService.isConfigured(),
      /** Fixed WETH seed at launch — paid by launcher wallet (`DEPLOY_BOND_ETH`), not the user. */
      platformSubsidizedInitialBuyEth: Number(webInitialBuyDefaultEth()),
    });
  });

  app.options('/api/deploy-cooldown-check', (req, res) => {
    const h = webDeployCorsHeadersRead(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(204).end();
  });

  app.get('/api/deploy-cooldown-check', async (req: Request, res: Response) => {
    const h = webDeployCorsHeadersRead(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);

    const rawSymbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim() : '';
    const rawName = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    const symbol = rawSymbol.toUpperCase().slice(0, 10);
    const name = rawName;

    const tickerConflict =
      symbol.length >= 1 ? await getGlobalTickerCooldownConflict(symbol) : null;
    const nameConflict =
      name.length >= 2 ? await getGlobalNameCooldownConflict(name) : null;
    const tickerReserved = symbol.length >= 1 && isReservedTicker(symbol);
    const nameReserved = name.length >= 2 && isReservedTokenName(name);

    res.json({
      cooldownHours: globalTickerCooldownHours(),
      tickerConflict,
      nameConflict,
      tickerReserved,
      nameReserved,
      reservedTickerMessage: tickerReserved ? reservedTickerUserMessage(symbol) : null,
      reservedNameMessage: nameReserved ? reservedNameUserMessage() : null,
    });
  });

  app.options('/api/deploy', (req, res) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(204).end();
  });

  app.options('/api/deploy-preview', (req, res) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(204).end();
  });

  app.post('/api/deploy-preview', async (req: Request, res: Response) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    try {
      const out = await previewWebDeployRateLimit(req, neynar);
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Preview failed';
      logger.warn('Web deploy preview failed', { error: msg });
      let status = 500;
      if (/authorization|bearer|access token|privy is not configured/i.test(msg)) {
        status = 401;
      } else if (
        msg.includes('not found') ||
        msg.includes('Invalid') ||
        msg.includes('must be') ||
        msg.includes('Choose a fee') ||
        msg.includes('No embedded Ethereum') ||
        msg.includes('requires') ||
        msg.includes('anonymousClientId')
      ) {
        status = 400;
      } else if (
        msg.includes('You can only launch') ||
        msg.includes('Deploy rate limit reached')
      ) {
        status = 409;
      }
      res.status(status).json({ error: msg });
    }
  });

  app.post('/api/deploy', async (req: Request, res: Response) => {
    const h = webDeployCorsHeaders(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);

    let paymentTxToRelease: string | null = null;

    try {
      const body = req.body as DeployWebBody;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const symbolRaw = typeof body.symbol === 'string' ? body.symbol.trim() : '';
      const symbol = symbolRaw.toUpperCase().slice(0, 10);

      if (name.length < 2 || name.length > 64) {
        res.status(400).json({ error: 'Token name must be 2–64 characters.' });
        return;
      }
      if (symbol.length < 1 || symbol.length > 10) {
        res.status(400).json({ error: 'Symbol must be 1–10 characters.' });
        return;
      }

      if (isReservedTicker(symbol)) {
        res.status(400).json({ error: reservedTickerUserMessage(symbol) });
        return;
      }
      if (isReservedTokenName(name)) {
        res.status(400).json({ error: reservedNameUserMessage() });
        return;
      }

      if (await isTickerGloballyReserved(symbol)) {
        const conflict = await getGlobalTickerCooldownConflict(symbol);
        res.status(409).json({
          error: conflict
            ? formatDeployCooldownConflictMessage(conflict)
            : await formatGlobalTickerCooldownMessage(symbol),
          conflict,
        });
        return;
      }

      if (await isNameGloballyReserved(name)) {
        const conflict = await getGlobalNameCooldownConflict(name);
        res.status(409).json({
          error: conflict
            ? formatDeployCooldownConflictMessage(conflict)
            : await formatGlobalNameCooldownMessage(name),
          conflict,
        });
        return;
      }

      const imageUrl = normalizeWebDeployImage(body.imageUrl);
      if (!imageUrl) {
        res.status(400).json({
          error:
            'Token logo is required. Upload an image on the Launch tab or paste a public HTTPS image URL.',
        });
        return;
      }
      const userDescription = typeof body.description === 'string' ? body.description.trim() : '';
      const websiteUrl = normalizeWebsiteUrl(body.websiteUrl);
      const xUrl = normalizeTokenXUrl(body.xUrl);
      if (typeof body.websiteUrl === 'string' && body.websiteUrl.trim() && !websiteUrl) {
        res.status(400).json({ error: 'Website must be a valid https URL.' });
        return;
      }
      if (typeof body.xUrl === 'string' && body.xUrl.trim() && !xUrl) {
        res.status(400).json({ error: 'X link must be a valid x.com URL or @handle.' });
        return;
      }

      const clientKindRaw =
        typeof body.clientKind === 'string' ? body.clientKind.trim().toLowerCase() : '';
      let webClientKind: 'web' | 'agent' = clientKindRaw === 'agent' ? 'agent' : 'web';

      const paste =
        typeof body.recipientPaste === 'string' ? parseRecipientPaste(body.recipientPaste) : {};

      const deployChain = resolveDeployChain({ explicit: body.chain });
      if (deployChain === 'ethereum') {
        assertEthereumDeployConfigured();
      }

      const isAgentWalletDeploy = body.feeTarget === 'agent_wallet';

      const feeTarget: 'self' | 'other' | 'no_dev' | 'agent_wallet' =
        body.feeTarget === 'agent_wallet'
          ? 'agent_wallet'
          : body.feeTarget === 'no_dev'
            ? 'no_dev'
            : body.feeTarget === 'other'
              ? 'other'
              : 'self';

      const bearer = hasBearerToken(req.headers.authorization);
      const allowAnonNoDev = feeTarget === 'no_dev' && !bearer;

      if (!allowAnonNoDev && !isAgentWalletDeploy && !config.privy.enabled) {
        res.status(503).json({ error: 'Web deploy requires Privy (PRIVY_APP_ID / PRIVY_APP_SECRET).' });
        return;
      }

      let userId: string;
      let anonymousNoDev = false;
      let agentWalletDeploy = false;
      let agentVerifiedFee: Address | null = null;
      let agentMetadataJson: string | undefined;
      let agentProviderForLabel = '';
      let agentAuthIsPayment = false;

      if (isAgentWalletDeploy) {
        webClientKind = 'agent';
        const captchaJwt = readAgentCaptchaToken(req.headers as any, body);
        if (!captchaJwt) {
          res.status(400).json({
            error:
              'Agent captcha deploy requires X-Agent-Captcha-JWT header or agentCaptchaJwt in body.',
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

        // Extract wallet address from CAPTCHA JWT claims
        const walletFromCaptcha = captchaPayload.walletAddress;
        let agentVerifiedFeeFromCaptcha: Address;
        try {
          agentVerifiedFeeFromCaptcha = getAddress(walletFromCaptcha);
        } catch {
          res.status(400).json({ error: 'Invalid walletAddress in CAPTCHA JWT.' });
          return;
        }

        // CAPTCHA verification = authorization. Deploy directly without signature or payment.
        agentVerifiedFee = agentVerifiedFeeFromCaptcha;
        agentMetadataJson = serializeAgentDeployMetadata({
          ...body,
          auth: 'captcha',
          agentId: captchaPayload.agentId,
        });

        userId = `agent:${agentVerifiedFee}`;
        agentWalletDeploy = true;
        agentProviderForLabel =
          typeof body.agentProvider === 'string' ? body.agentProvider.trim().slice(0, 64) : '';
      } else if (allowAnonNoDev) {
        const aid = normalizeAnonymousClientId(body.anonymousClientId);
        if (!aid) {
          res.status(400).json({
            error:
              'No Dev without sign-in requires anonymousClientId (the app generates one in session storage).',
          });
          return;
        }
        userId = `web-anon:${aid}`;
        anonymousNoDev = true;
      } else {
        const { userId: uid } = await verifyPrivyBearerToken(req.headers.authorization);
        userId = uid;
      }

      const runSelfFeeQueued =
        feeTarget === 'self' && !allowAnonNoDev && !isAgentWalletDeploy;
      const runThirdPartyQueued =
        (feeTarget === 'other' || isAgentWalletDeploy) && !allowAnonNoDev;

      const thirdPartyQueueKey = (): string => {
        if (agentVerifiedFee) {
          try {
            return getAddress(agentVerifiedFee).toLowerCase();
          } catch {
            return 'agent-fee';
          }
        }
        const raw = body.recipientAddress?.trim() || paste.walletAddress;
        if (raw && /^0x[a-fA-F0-9]{40}$/i.test(raw)) {
          try {
            return getAddress(raw).toLowerCase();
          } catch {
            /* fall through */
          }
        }
        const parts = [
          body.farcasterUsername,
          body.xUsername,
          body.githubUsername,
          body.telegramUsername,
          body.discordUserId,
          paste.farcasterUsername,
          paste.xUsername,
          paste.githubUsername,
          paste.telegramUsername,
          paste.discordUserId,
        ]
          .map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : ''))
          .filter(Boolean);
        return parts.join('|') || 'web-other-fee';
      };

      const executeDeploy = async (): Promise<void> => {
      let privyUserRecord: unknown = null;
      if (!anonymousNoDev && !agentWalletDeploy) {
        try {
          privyUserRecord = await fetchPrivyUserRecordById(userId);
        } catch (e: unknown) {
          logger.warn('Could not load Privy user for web deploy', {
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }

      let fee:
        | { kind: 'no_dev' }
        | { kind: 'self'; privyUserId: string; privyUser?: unknown }
        | {
            kind: 'other';
            address?: string;
            farcasterUsername?: string;
            xUsername?: string;
            githubUsername?: string;
            telegramUsername?: string;
            discordUserId?: string;
          };

      if (isAgentWalletDeploy && agentVerifiedFee) {
        fee = { kind: 'other', address: agentVerifiedFee };
      } else if (feeTarget === 'no_dev') {
        fee = { kind: 'no_dev' };
      } else if (feeTarget === 'self') {
        fee = {
          kind: 'self',
          privyUserId: userId,
          privyUser: privyUserRecord ?? undefined,
        };
      } else {
        fee = {
          kind: 'other',
          address: body.recipientAddress?.trim() || paste.walletAddress,
          farcasterUsername: body.farcasterUsername?.trim() || paste.farcasterUsername,
          xUsername: body.xUsername?.trim() || paste.xUsername,
          githubUsername: body.githubUsername?.trim() || paste.githubUsername,
          telegramUsername:
            (typeof body.telegramUsername === 'string' ? body.telegramUsername.trim() : undefined) ||
            paste.telegramUsername,
          discordUserId:
            (typeof body.discordUserId === 'string' ? body.discordUserId.trim() : undefined) ||
            paste.discordUserId,
        };
      }

      let resolved = await resolveWebFeeRecipient(neynar, fee);

      let rateLimitForcedPlatformFee = false;
      let rateLimitForcedBurn = false;

      if (config.webOnlyMode && fee.kind === 'self') {
        const limited = await applyWebDeployRateLimit({
          walletAddress: resolved.walletAddress,
          feeRecipientLabel: resolved.feeRecipientLabel,
          feeToSelf: true,
          deployerId: userId,
          privyUserId: !anonymousNoDev && !agentWalletDeploy ? userId : null,
        });
        rateLimitForcedPlatformFee = limited.rateLimitForcedPlatformFee;
        resolved = {
          ...resolved,
          walletAddress: limited.walletAddress,
          ...(limited.feeRecipientLabel ? { feeRecipientLabel: limited.feeRecipientLabel } : {}),
        };
      } else {
        if (config.strictDeployRateLimits && fee.kind === 'self') {
          const limitErr = await selfFeeDeployLimitErrorOrNull({
            privyUserId: !anonymousNoDev && !agentWalletDeploy ? userId : null,
            platform: 'web',
            deployerId: userId,
          });
          if (limitErr) {
            res.status(409).json({ error: limitErr });
            return;
          }
        }

        if (fee.kind !== 'no_dev') {
          const limited = await applyDeployRateLimitBurn({
            walletAddress: resolved.walletAddress,
            feeRecipientLabel: resolved.feeRecipientLabel,
            feeToSelf: fee.kind === 'self',
            platform: 'web',
            deployerId: userId,
            privyUserId:
              !anonymousNoDev && !agentWalletDeploy ? userId : null,
          });
          rateLimitForcedBurn = limited.rateLimitForcedBurn;
          if (limited.rateLimitForcedBurn) {
            resolved = {
              walletAddress: limited.walletAddress,
              feeSummaryLine: `No Dev — ${MEME_TOKEN_DESCRIPTION_TAGLINE}`,
              feeRecipientLabel: limited.feeRecipientLabel ?? RATE_LIMIT_FORCED_DEAD_FEE_LABEL,
            };
          } else {
            resolved = {
              ...resolved,
              walletAddress: limited.walletAddress,
              ...(limited.feeRecipientLabel
                ? { feeRecipientLabel: limited.feeRecipientLabel }
                : {}),
            };
          }
        }
      }

      let initiatorAttribution = 'signed-in user';
      if (anonymousNoDev) {
        initiatorAttribution = 'anonymous visitor (No Dev)';
      } else if (agentWalletDeploy && agentVerifiedFee) {
        initiatorAttribution = `verified agent wallet ${agentVerifiedFee.slice(0, 6)}…${agentVerifiedFee.slice(-4)}`;
      } else if (privyUserRecord) {
        initiatorAttribution = formatWebDeployInitiatorAttribution(privyUserRecord);
      }

      const feeBlock = `${resolved.feeSummaryLine}. Deployed via hoodmarkets by ${initiatorAttribution}.`;
      const useMemeTagline =
        ((feeTarget === 'no_dev' || fee.kind === 'no_dev') && !isAgentWalletDeploy) ||
        rateLimitForcedBurn;
      const platformFeeNote = rateLimitForcedPlatformFee
        ? 'Trading fees on this token go to hood.markets (24h deploy limit).'
        : '';
      const fullDescription = [
        userDescription,
        useMemeTagline ? MEME_TOKEN_DESCRIPTION_TAGLINE : '',
        platformFeeNote,
        feeBlock,
      ]
        .filter(Boolean)
        .join('\n\n');

      const feeCooldownErr = await thirdPartyFeeRecipientCooldownErrorOrNull(
        resolved.walletAddress,
        {
          feeToSelf: fee.kind === 'self' && !rateLimitForcedBurn && !rateLimitForcedPlatformFee,
          rateLimitForcedBurn,
          feeRecipientLabel: resolved.feeRecipientLabel,
        },
      );
      if (feeCooldownErr) {
        res.status(409).json({ error: feeCooldownErr });
        return;
      }

      let devBuyAmount = config.deployBondWei;

      const deployReq: DeployRequest = {
        platform: 'web',
        sourceId: `web-${crypto.randomUUID()}`,
        authorId: userId,
        name,
        symbol,
        walletAddress: resolved.walletAddress,
        chain: deployChain,
      };

      let { isDuplicate, hash: deployDedupHash } = await checkAndRecordDeploy(deployReq);
      if (isDuplicate) {
        const prior = await listDeploymentCatalogByDeployer(userId, 50, 0);
        const nameKey = name.toLowerCase();
        const symKey = symbol.replace(/^\$/, '').toUpperCase();
        const launchedOnChain = prior.some(
          (row) =>
            row.tokenName.trim().toLowerCase() === nameKey &&
            row.tokenSymbol.replace(/^\$/, '').toUpperCase() === symKey,
        );
        if (!launchedOnChain) {
          await releaseDeployAttempt(hashDeployRequest(deployReq));
          const retry = await checkAndRecordDeploy(deployReq);
          isDuplicate = retry.isDuplicate;
          deployDedupHash = retry.hash;
        }
      }
      if (isDuplicate) {
        res.status(409).json({
          error:
            'This name and ticker were already launched successfully for your account. Pick a different name or ticker.',
        });
        return;
      }

      try {
      /** Match fee recipient identity for self-fee deploys so “deployed by” = the account used (Privy / X / GitHub / …). */
      const deployerLabel = anonymousNoDev
        ? 'Web (No Dev · anonymous)'
        : agentWalletDeploy
          ? agentProviderForLabel
            ? `Web (agent wallet · ${agentProviderForLabel}${agentAuthIsPayment ? ' · payment' : ''} · captcha)`
            : `Web (agent wallet${agentAuthIsPayment ? ' · payment' : ''} · agent-captcha)`
          : fee.kind === 'self' && !rateLimitForcedBurn && !rateLimitForcedPlatformFee
            ? resolved.feeRecipientLabel.slice(0, 256)
            : initiatorAttribution === 'signed-in user'
              ? 'Web (signed in)'
              : initiatorAttribution.slice(0, 256);

      const feeToSelfEffective =
        fee.kind === 'self' && !rateLimitForcedBurn && !rateLimitForcedPlatformFee;

      const feeRecipientLabelForCatalog = rateLimitForcedPlatformFee
        ? RATE_LIMIT_FORCED_PLATFORM_FEE_LABEL
        : rateLimitForcedBurn
        ? RATE_LIMIT_FORCED_DEAD_FEE_LABEL
        : agentWalletDeploy
          ? `Agent${agentProviderForLabel ? ` · ${agentProviderForLabel}` : ''} · ${resolved.walletAddress.slice(0, 6)}…${resolved.walletAddress.slice(-4)}`
          : resolved.feeRecipientLabel;

      const result = await deployer.deployToken({
        name,
        symbol,
        walletAddress: resolved.walletAddress,
        devBuyAmount,
        hookType: 'static',
        description: fullDescription,
        imageUrl,
        websiteUrl,
        xUrl,
        username: 'web',
        platform: 'web',
        deployerId: userId,
        deployerLabel,
        feeRecipientLabel: feeRecipientLabelForCatalog,
        feeToSelf: feeToSelfEffective,
        ...(rateLimitForcedPlatformFee ? { feesToPlatformOnly: true } : {}),
        ...(!anonymousNoDev && !agentWalletDeploy ? { privyUserId: userId } : {}),
        clientKind: webClientKind,
        ...(agentWalletDeploy && agentMetadataJson ? { agentMetadataJson } : {}),
        chain: deployChain,
      });

      const links = deployer.generateTokenLinks(result.tokenAddress, result.chain);

      logger.info('Web deploy success', {
        token: result.tokenAddress,
        chain: result.chain,
        userId,
        anonymousNoDev,
        feeWallet: resolved.walletAddress,
        initiatorAttribution,
        ...(agentMetadataJson ? { agentMetadata: agentMetadataJson } : {}),
      });

      const metaForDiscord = parseAgentMetadataJson(agentMetadataJson);
      void notifyDiscordWebLaunch({
        name,
        symbol,
        tokenAddress: result.tokenAddress,
        poolId: result.poolId,
        transactionHash: result.transactionHash,
        feeWallet: resolved.walletAddress,
        initiatorAttribution,
        feeRecipientLabel: feeRecipientLabelForCatalog,
        links,
        platformField: agentWalletDeploy ? '**Web** (agent wallet · captcha)' : undefined,
        agentMetadataFields: metaForDiscord,
      });

      const metaResponse = parseAgentMetadataJson(agentMetadataJson);

      // Prior launches for this fee wallet (split like Telegram / Discord pre-deploy hints).
      let recipientPriorRollingHours = 0;
      let recipientSelfFeePriorTokens: { tokenName: string; tokenSymbol: string; tokenAddress: string }[] =
        [];
      let recipientThirdPartyPriorTokens: { tokenName: string; tokenSymbol: string; tokenAddress: string }[] =
        [];
      if (feeTarget === 'other') {
        const newAddr = result.tokenAddress.toLowerCase();
        const skipNew = <T extends { tokenAddress: string }>(rows: T[]) =>
          rows.filter((t) => t.tokenAddress.toLowerCase() !== newAddr).slice(0, 5);

        recipientSelfFeePriorTokens = skipNew(
          await listSelfFeeTokensForFeeRecipient(resolved.walletAddress, 8),
        );
        const h = deployRateLimitRollingHours();
        recipientPriorRollingHours = h;
        if (h > 0) {
          recipientThirdPartyPriorTokens = skipNew(
            await listThirdPartyFeeTokensForFeeRecipientRollingHours(resolved.walletAddress, h, 8),
          );
        }
      }

      const hasRecipientPrior =
        recipientSelfFeePriorTokens.length > 0 || recipientThirdPartyPriorTokens.length > 0;

      res.json({
        ok: true,
        chain: result.chain,
        tokenAddress: result.tokenAddress,
        poolId: result.poolId,
        transactionHash: result.transactionHash,
        feeWallet: resolved.walletAddress,
        feeSummary: resolved.feeSummaryLine,
        links,
        clientKind: webClientKind,
        ...(result.imageUrl ? { imageUrl: result.imageUrl } : {}),
        ...(hasRecipientPrior
          ? {
              recipientPriorRollingHours,
              recipientSelfFeePriorTokens,
              recipientThirdPartyPriorTokens,
            }
          : {}),
        ...(agentWalletDeploy && metaResponse ? { agentMetadata: metaResponse } : {}),
      });
      } catch (deployErr) {
        await releaseDeployAttempt(deployDedupHash);
        throw deployErr;
      }
      };

      if (runSelfFeeQueued) {
        await runAfterPriorWebSelfFeeWork(userId, executeDeploy);
      } else if (runThirdPartyQueued) {
        await runAfterPriorWebThirdPartyFeeWork(thirdPartyQueueKey(), executeDeploy);
      } else {
        await executeDeploy();
      }
    } catch (e: any) {
      if (paymentTxToRelease) {
        void releaseAgentPaymentTx(paymentTxToRelease);
      }
      const msg = formatDeployError(e);
      logger.warn('Web deploy failed', { error: msg });
      let status = 500;
      if (
        /authorization|bearer|access token|privy is not configured/i.test(msg)
      ) {
        status = 401;
      } else if (
        msg.includes('not found') ||
        msg.includes('Invalid') ||
        msg.includes('must be') ||
        msg.includes('Choose a fee') ||
        msg.includes('No embedded Ethereum') ||
        msg.includes('reserved') ||
        msg.includes('Ethereum deployments are disabled')
      ) {
        status = 400;
      }
      res.status(status).json({ error: msg });
    }
  });
}
