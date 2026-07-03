import type { Express, Request, Response } from 'express';
import { config } from '../config.js';
import {
  countDeploymentsByXUsername,
  listDeploymentCatalogForUser,
  listDeploymentsByXUsername,
  type DeploymentCatalogRow,
} from '../lib/deploymentCatalog.js';
import { fetchPrivyUserRecordById, extractTwitterUsernameFromPrivyUser } from '../lib/privy.js';
import { verifyPrivyBearerToken } from '../lib/privyAccessToken.js';
import { normalizeXUsername } from '../lib/requesterXUsername.js';
import { webDeployCorsHeadersRead } from '../lib/webDeployCors.js';

const WEB_BASE = (process.env.LAUNCHER_WEB_URL || 'https://hood.markets').replace(/\/$/, '');

function publicProfileUrl(xUsername: string): string {
  const handle = normalizeXUsername(xUsername);
  if (!handle) return WEB_BASE;
  return `${WEB_BASE}/?profile=x&user=${encodeURIComponent(handle)}`;
}

function mergeDeploymentsByToken(
  ...groups: DeploymentCatalogRow[][]
): DeploymentCatalogRow[] {
  const seen = new Set<string>();
  const out: DeploymentCatalogRow[] = [];
  for (const group of groups) {
    for (const row of group) {
      const key = row.tokenAddress.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return out;
}

export function registerDeployerProfileRoutes(app: Express): void {
  app.options('/api/deployer-profile/x/:username', (req, res) => {
    const h = webDeployCorsHeadersRead(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(204).end();
  });

  app.get('/api/deployer-profile/x/:username', async (req: Request, res: Response) => {
    const h = webDeployCorsHeadersRead(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);

    const handle = normalizeXUsername(
      typeof req.params.username === 'string' ? req.params.username : '',
    );
    if (!handle) {
      res.status(400).json({ error: 'username must be a valid X handle.' });
      return;
    }

    try {
      const rawLimit = req.query.limit;
      const rawOffset = req.query.offset;
      const limit = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : 50;
      const offset = typeof rawOffset === 'string' ? Number.parseInt(rawOffset, 10) : 0;
      const [launchCount, deployments] = await Promise.all([
        countDeploymentsByXUsername(handle),
        listDeploymentsByXUsername(
          handle,
          Number.isFinite(limit) ? limit : 50,
          Number.isFinite(offset) ? offset : 0,
        ),
      ]);

      res.json({
        platform: 'x',
        xUsername: handle,
        launchCount,
        profileUrl: publicProfileUrl(handle),
        deployments,
      });
    } catch {
      res.status(500).json({ error: 'Failed to load deployer profile.' });
    }
  });

  app.options('/api/my-deployer-profile', (req, res) => {
    const h = webDeployCorsHeadersRead(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.status(204).end();
  });

  app.get('/api/my-deployer-profile', async (req: Request, res: Response) => {
    const h = webDeployCorsHeadersRead(req.headers.origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);

    if (!config.privy.enabled) {
      res.status(503).json({ error: 'Privy is not configured on the server.' });
      return;
    }

    try {
      const { userId } = await verifyPrivyBearerToken(req.headers.authorization);
      const rawWallet =
        typeof req.query.walletAddress === 'string' ? req.query.walletAddress.trim() : '';
      let resolvedWallet = '';
      if (/^0x[0-9a-fA-F]{40}$/.test(rawWallet)) {
        try {
          resolvedWallet = rawWallet.toLowerCase();
        } catch {
          /* ignore */
        }
      }

      const userRecord = await fetchPrivyUserRecordById(userId);
      const xUsername = extractTwitterUsernameFromPrivyUser(userRecord);

      const [accountDeployments, xDeployments] = await Promise.all([
        listDeploymentCatalogForUser(userId, resolvedWallet, 100, 0),
        xUsername ? listDeploymentsByXUsername(xUsername, 100, 0) : Promise.resolve([]),
      ]);

      const launchedByAccount = accountDeployments.filter((d) => d.deployedByViewer);
      const mergedLaunches = mergeDeploymentsByToken(launchedByAccount, xDeployments);
      const xLaunchCount = xUsername ? await countDeploymentsByXUsername(xUsername) : 0;

      res.json({
        xUsername,
        xLinked: !!xUsername,
        xLaunchCount,
        walletLaunchCount: launchedByAccount.length,
        totalLaunchCount: mergedLaunches.length,
        publicProfileUrl: xUsername ? publicProfileUrl(xUsername) : null,
        deployments: mergedLaunches,
        accountDeployments,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unauthorized';
      const status = /authorization|bearer|access token|privy is not configured/i.test(msg)
        ? 401
        : 500;
      res.status(status).json({ error: msg });
    }
  });
}
