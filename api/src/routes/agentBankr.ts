import type { Express, Request, Response } from 'express';
import { getAddress, isAddress } from 'viem';
import { config } from '../config.js';
import {
  getDeploymentByTokenAddress,
  getNewestDeploymentByTickerSymbol,
  listDeploymentCatalogByFeeRecipient,
} from '../lib/deploymentCatalog.js';
import { prepareAgentBuy, prepareAgentSell } from '../lib/agentSwapPrepare.js';
import {
  resolveAgentTokenLookup,
  runAgentDeployPreflight,
} from '../lib/agentDeployPreflight.js';
import { agentDeploySkipCaptchaForRequest } from '../lib/agentWalletDeployAuth.js';
import {
  agentDeployConfirmReplyHint,
  buildAgentDeployConfirmSummary,
  resolveAgentDeployImageUrl,
} from '../lib/agentDeployImage.js';
import { ROBINHOOD_CHAIN_ID } from '../lib/robinhoodChain.js';
import { webDeployCorsHeaders } from '../lib/webDeployCors.js';

const API_BASE = (process.env.LAUNCHER_API_URL || 'https://api.hood.markets').replace(/\/$/, '');
const WEB_BASE = (process.env.LAUNCHER_WEB_URL || 'https://hood.markets').replace(/\/$/, '');

function cors(req: Request, res: Response): void {
  const h = webDeployCorsHeaders(req.headers.origin);
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
}

function walletFromReq(req: Request): `0x${string}` | null {
  const header = req.headers['x-wallet-address'];
  if (typeof header === 'string' && isAddress(header.trim())) {
    try {
      return getAddress(header.trim());
    } catch {
      return null;
    }
  }
  const q = req.query.wallet;
  if (typeof q === 'string' && isAddress(q.trim())) {
    try {
      return getAddress(q.trim());
    } catch {
      return null;
    }
  }
  return null;
}

function walletFromBody(body: unknown): `0x${string}` | null {
  if (!body || typeof body !== 'object') return null;
  const w = (body as { wallet?: string }).wallet;
  if (typeof w === 'string' && isAddress(w.trim())) {
    try {
      return getAddress(w.trim());
    } catch {
      return null;
    }
  }
  return null;
}

function launchTypeFromPoolId(poolId: string | undefined): 'simple' | 'pro' | 'unknown' {
  if (!poolId) return 'unknown';
  return poolId.toLowerCase().startsWith('v3:') ? 'simple' : 'pro';
}

function deploymentToAgentTokenInfo(
  deployment: NonNullable<Awaited<ReturnType<typeof getDeploymentByTokenAddress>>>,
) {
  const launchType = launchTypeFromPoolId(deployment.poolId);
  return {
    tokenName: deployment.tokenName,
    tokenSymbol: deployment.tokenSymbol,
    tokenAddress: deployment.tokenAddress,
    poolId: deployment.poolId,
    launchType,
    swapMode: launchType === 'simple' ? 'uniswap' : 'hoodmarkets-helper',
    oneClickSwapOnHoodmarkets: launchType === 'pro',
    tokenPageUrl: `${WEB_BASE}/?token=${deployment.tokenAddress}`,
    dexscreenerUrl: `https://dexscreener.com/robinhood/${deployment.tokenAddress}`,
    uniswapSwapUrl: `https://app.uniswap.org/swap?chain=robinhood&outputCurrency=${deployment.tokenAddress}`,
    feeRecipientAddress: deployment.feeRecipientAddress,
  };
}

/**
 * Bankr / agent skill endpoints — structured JSON for @bankrbot and other agents.
 * Wallet: `x-wallet-address` header or `?wallet=` / body `wallet`.
 */
export function registerAgentBankrRoutes(app: Express): void {
  app.get('/health', (req, res) => {
    cors(req, res);
    res.json({
      ok: true,
      service: 'hoodmarkets',
      chainId: ROBINHOOD_CHAIN_ID,
      web: WEB_BASE,
      api: API_BASE,
    });
  });

  app.options('/api/agent/briefing', (req, res) => {
    cors(req, res);
    res.status(204).end();
  });

  app.get('/api/agent/briefing', async (req: Request, res: Response) => {
    cors(req, res);
    const wallet = walletFromReq(req);
    if (!wallet) {
      res.status(400).json({ ok: false, error: 'Pass wallet=0x… or x-wallet-address header.' });
      return;
    }

    const rows = await listDeploymentCatalogByFeeRecipient(wallet, 50, 0);
    const deployments = rows.map((r) => ({
      tokenName: r.tokenName,
      tokenSymbol: r.tokenSymbol,
      tokenAddress: r.tokenAddress,
      poolId: r.poolId,
      launchType: r.poolId?.toLowerCase().startsWith('v3:') ? 'simple' : 'pro',
      transactionHash: r.transactionHash,
      tokenPageUrl: `${WEB_BASE}/?token=${r.tokenAddress}`,
      dexscreenerUrl: `https://dexscreener.com/robinhood/${r.tokenAddress}`,
      uniswapUrl: `https://app.uniswap.org/explore/tokens/robinhood/${r.tokenAddress}`,
    }));

    res.json({
      ok: true,
      wallet,
      chainId: ROBINHOOD_CHAIN_ID,
      deploymentCount: deployments.length,
      deployments,
      links: {
        launch: `${WEB_BASE}/`,
        docs: `${WEB_BASE}/agent-api`,
        captchaChallenge: `${API_BASE}/api/agent-captcha/challenge`,
      },
      feeSplitSimple: {
        platformPercent: 5,
        creatorPercent: 95,
        note: 'Simple (V3) launches embed 5% hood.markets platform fee in the LP locker contract.',
      },
    });
  });

  app.options('/api/agent/preflight-deploy', (req, res) => {
    cors(req, res);
    res.status(204).end();
  });

  app.get('/api/agent/preflight-deploy', async (req: Request, res: Response) => {
    cors(req, res);
    const wallet = walletFromReq(req);
    if (!wallet) {
      res.status(400).json({ ok: false, error: 'Pass wallet=0x… or x-wallet-address header.' });
      return;
    }

    const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    const symbolRaw = typeof req.query.symbol === 'string' ? req.query.symbol.trim() : '';
    const launchModeRaw =
      typeof req.query.launchMode === 'string' ? req.query.launchMode.trim().toLowerCase() : '';
    const launchMode =
      launchModeRaw === 'pro' ? 'pro' : launchModeRaw === 'simple' ? 'simple' : config.defaultLaunchMode;

    if (!name || !symbolRaw) {
      res.status(400).json({
        ok: false,
        error: 'Query params name and symbol are required.',
      });
      return;
    }

    const preflight = await runAgentDeployPreflight({
      wallet,
      name,
      symbol: symbolRaw,
      launchMode,
    });

    res.status(preflight.canDeploy ? 200 : 409).json({
      ...preflight,
      chainId: ROBINHOOD_CHAIN_ID,
      cooldownCheckUrl: `${API_BASE}/api/deploy-cooldown-check?symbol=${encodeURIComponent(symbolRaw)}&name=${encodeURIComponent(name)}`,
    });
  });

  app.post('/api/agent/preflight-deploy', async (req: Request, res: Response) => {
    cors(req, res);
    const wallet = walletFromBody(req.body) ?? walletFromReq(req);
    if (!wallet) {
      res.status(400).json({ ok: false, error: 'wallet required.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const symbol = typeof body.symbol === 'string' ? body.symbol.trim() : '';
    const launchModeRaw =
      typeof body.launchMode === 'string' ? body.launchMode.trim().toLowerCase() : '';
    const launchMode =
      launchModeRaw === 'pro' ? 'pro' : launchModeRaw === 'simple' ? 'simple' : config.defaultLaunchMode;

    if (!name || !symbol) {
      res.status(400).json({ ok: false, error: 'name and symbol are required.' });
      return;
    }

    const preflight = await runAgentDeployPreflight({
      wallet,
      name,
      symbol,
      launchMode,
    });

    res.status(preflight.canDeploy ? 200 : 409).json({
      ...preflight,
      chainId: ROBINHOOD_CHAIN_ID,
    });
  });

  app.options('/api/agent/token-info', (req, res) => {
    cors(req, res);
    res.status(204).end();
  });

  app.get('/api/agent/token-info', async (req: Request, res: Response) => {
    cors(req, res);
    const rawToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const rawSymbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim() : '';
    const lookupRaw = rawToken || rawSymbol;
    if (!lookupRaw) {
      res.status(400).json({
        ok: false,
        error: 'Pass token=0x… or symbol=TICKER.',
      });
      return;
    }

    const lookup = await resolveAgentTokenLookup(lookupRaw);
    if (!lookup) {
      res.status(400).json({ ok: false, error: 'Invalid token address or symbol.' });
      return;
    }

    const deployment =
      lookup.kind === 'address'
        ? await getDeploymentByTokenAddress(lookup.address)
        : await getNewestDeploymentByTickerSymbol(lookup.symbol);

    if (!deployment) {
      res.status(404).json({
        ok: false,
        error: 'Token not found in hood.markets catalog.',
        hint: 'Only tokens launched on hood.markets appear in the catalog.',
      });
      return;
    }

    res.json({
      ok: true,
      ...deploymentToAgentTokenInfo(deployment),
    });
  });

  app.options('/api/agent/prepare-deploy', (req, res) => {
    cors(req, res);
    res.status(204).end();
  });

  app.post('/api/agent/prepare-deploy', async (req: Request, res: Response) => {
    cors(req, res);
    const wallet = walletFromBody(req.body) ?? walletFromReq(req);
    if (!wallet) {
      res.status(400).json({ ok: false, error: 'wallet (0x…) required in body or x-wallet-address.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
    const launchModeRaw =
      typeof body.launchMode === 'string' ? body.launchMode.trim().toLowerCase() : '';
    const launchMode =
      launchModeRaw === 'pro' ? 'pro' : launchModeRaw === 'simple' ? 'simple' : config.defaultLaunchMode;

    if (!name || name.length < 2) {
      res.status(400).json({ ok: false, error: 'name is required (min 2 chars).' });
      return;
    }
    if (!symbol || symbol.length < 1) {
      res.status(400).json({ ok: false, error: 'symbol is required.' });
      return;
    }

    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const websiteUrl = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() : '';
    const xUrl = typeof body.xUrl === 'string' ? body.xUrl.trim() : '';
    const resolvedImage = resolveAgentDeployImageUrl({
      imageUrl: body.imageUrl,
      tweetImageUrl: body.tweetImageUrl,
      mediaUrl: body.mediaUrl,
      tweetMedia: body.tweetMedia,
      tweetText: body.tweetText,
      tweet: body.tweet,
    });

    const agentChannel =
      typeof body.agentChannel === 'string' ? body.agentChannel.trim().toLowerCase() : '';
    const { skip: skipCaptcha, channel: resolvedChannel } = agentDeploySkipCaptchaForRequest(
      req.headers as { [k: string]: string | string[] | undefined },
      { agentChannel: agentChannel || undefined, agentRuntime: body.agentRuntime },
    );

    if (!resolvedImage.imageUrl || !resolvedImage.imageSource) {
      res.status(400).json({
        ok: false,
        error: 'Token logo is required before deploy.',
        imageRequired: true,
        replyHint:
          resolvedChannel === 'x'
            ? 'Attach a photo to the tweet, or pass tweetImageUrl / imageUrl from the original post when calling prepare-deploy.'
            : 'Pass imageUrl (HTTPS) or tweet media fields (tweetImageUrl, tweetMedia, tweet) on prepare-deploy.',
      });
      return;
    }

    const preflight = await runAgentDeployPreflight({
      wallet,
      name,
      symbol,
      launchMode,
    });

    if (!preflight.canDeploy) {
      res.status(409).json({
        ok: false,
        error: preflight.blockMessage,
        preflight,
        replyHint: preflight.blocks[0]?.replyHint ?? preflight.blockMessage,
      });
      return;
    }

    const deployBody = {
      name,
      symbol,
      feeTarget: 'agent_wallet',
      clientKind: 'agent',
      agentProvider: 'bankr',
      launchMode,
      imageUrl: resolvedImage.imageUrl,
      description,
      websiteUrl,
      xUrl,
      wallet,
      agentFeeRecipient: wallet,
      ...(resolvedChannel ? { agentChannel: resolvedChannel } : {}),
    };

    const confirmSummary = buildAgentDeployConfirmSummary({
      name,
      symbol,
      launchMode,
      feeRecipient: wallet,
      imageUrl: resolvedImage.imageUrl,
      imageSource: resolvedImage.imageSource,
      ...(description ? { description } : {}),
      ...(websiteUrl ? { websiteUrl } : {}),
      ...(xUrl ? { xUrl } : {}),
    });
    const confirmReplyHint = agentDeployConfirmReplyHint(confirmSummary);

    const deployHeaders: Record<string, string> = { 'x-wallet-address': wallet };
    if (resolvedChannel) deployHeaders['x-agent-channel'] = resolvedChannel;

    const steps = skipCaptcha
      ? [
          ...(resolvedChannel === 'x'
            ? [
                {
                  step: 'user_confirm',
                  note:
                    'Show the launch preview below, including the token logo from the original tweet. Ask the user to reply yes/confirm before deploy. Do not call deploy until they confirm.',
                  summary: confirmSummary,
                  replyHint: confirmReplyHint,
                  requiredFields: ['imageUrl', 'name', 'symbol'],
                },
              ]
            : []),
          {
            step: 'deploy',
            method: 'POST',
            url: `${API_BASE}/api/deploy`,
            headers: deployHeaders,
            body: deployBody,
            note:
              resolvedChannel === 'x'
                ? 'X channel — no haiku. User confirmed in-thread; pass linked wallet via x-wallet-address and agentChannel: x.'
                : 'Captcha skipped for this agent channel. Pass linked wallet via x-wallet-address.',
          },
        ]
      : [
          {
            step: 'captcha_challenge',
            method: 'GET',
            url: `${API_BASE}/api/agent-captcha/challenge`,
          },
          {
            step: 'captcha_verify',
            method: 'POST',
            url: `${API_BASE}/api/agent-captcha/verify`,
            body: {
              sessionId: '<from challenge>',
              response: '<haiku 3 lines mentioning topic word>',
              agentFeeRecipient: wallet,
            },
          },
          {
            step: 'deploy',
            method: 'POST',
            url: `${API_BASE}/api/deploy`,
            headers: { 'X-Agent-Captcha-JWT': '<jwt from verify>' },
            body: deployBody,
          },
        ];

    res.json({
      ok: true,
      wallet,
      chainId: ROBINHOOD_CHAIN_ID,
      launchMode,
      preflight: {
        warnings: preflight.warnings,
        proceedNotice: preflight.proceedNotice,
      },
      /** Server deploy — no Bankr /wallet/submit. Launcher pays gas + launch seed. */
      deployMode: 'server',
      captchaRequired: !skipCaptcha,
      agentChannel: resolvedChannel,
      confirmSummary,
      confirmReplyHint,
      imageUrl: resolvedImage.imageUrl,
      imageSource: resolvedImage.imageSource,
      steps,
      ...(skipCaptcha
        ? {}
        : {
            haikuRules:
              'Exactly 3 lines separated by \\n; must mention the challenge topic word. JWT valid 8 hours.',
          }),
      feeRecipient: wallet,
      tokenPageUrlTemplate: `${WEB_BASE}/?token={tokenAddress}`,
    });
  });

  app.options('/api/agent/prepare-buy', (req, res) => {
    cors(req, res);
    res.status(204).end();
  });

  app.post('/api/agent/prepare-buy', async (req: Request, res: Response) => {
    cors(req, res);
    const wallet = walletFromBody(req.body) ?? walletFromReq(req);
    if (!wallet) {
      res.status(400).json({ ok: false, error: 'wallet required.' });
      return;
    }
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';
    const amountEth =
      typeof body.amountEth === 'string'
        ? body.amountEth
        : typeof body.amount === 'string'
          ? body.amount
          : '';

    if (!tokenAddress) {
      res.status(400).json({ ok: false, error: 'tokenAddress is required.' });
      return;
    }
    if (!amountEth) {
      res.status(400).json({ ok: false, error: 'amountEth is required (e.g. 0.01).' });
      return;
    }

    const result = await prepareAgentBuy({ tokenAddress, amountEth, taker: wallet });
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json({
      ...result,
      wallet,
      bankrSubmitUrl: 'https://api.bankr.bot/wallet/submit',
      confirmHint: 'Submit each transaction via Bankr /wallet/submit with waitForConfirmation: true.',
    });
  });

  app.options('/api/agent/prepare-sell', (req, res) => {
    cors(req, res);
    res.status(204).end();
  });

  app.post('/api/agent/prepare-sell', async (req: Request, res: Response) => {
    cors(req, res);
    const wallet = walletFromBody(req.body) ?? walletFromReq(req);
    if (!wallet) {
      res.status(400).json({ ok: false, error: 'wallet required.' });
      return;
    }
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';
    const amount = typeof body.amount === 'string' ? body.amount : '';

    if (!tokenAddress) {
      res.status(400).json({ ok: false, error: 'tokenAddress is required.' });
      return;
    }
    if (!amount) {
      res.status(400).json({ ok: false, error: 'amount is required (token units, e.g. 1000000 or 1M).' });
      return;
    }

    const result = await prepareAgentSell({ tokenAddress, amount, taker: wallet });
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json({
      ...result,
      wallet,
      bankrSubmitUrl: 'https://api.bankr.bot/wallet/submit',
      confirmHint: 'Submit approve (if present) then sell via Bankr /wallet/submit.',
    });
  });
}
