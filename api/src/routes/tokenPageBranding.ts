import type { Express, Request, Response } from 'express';
import { getAddress } from 'viem';
import {
  getDeploymentByTokenAddress,
  updateDeploymentCatalogBranding,
} from '../lib/deploymentCatalog.js';
import { enrichDeploymentForPublicApi } from '../lib/deploymentPartyEnrichment.js';
import { fetchDexBrandingProfile } from '../lib/dexscreenerProfile.js';
import { resolveTokenPageAdmin, walletIsTokenPageAdmin } from '../lib/tokenPageAdmin.js';
import { verifyWebSessionBearer } from '../lib/webSessionAuth.js';
import { webDeployCorsHeaders, webDeployCorsHeadersRead } from '../lib/webDeployCors.js';

function parseToken(raw: string): string | null {
  const t = raw.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(t)) return null;
  try {
    return getAddress(t);
  } catch {
    return null;
  }
}

function setCorsRead(req: Request, res: Response): void {
  const h = webDeployCorsHeadersRead(req.headers.origin);
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
}

function setCorsWrite(req: Request, res: Response): void {
  const h = webDeployCorsHeaders(req.headers.origin);
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
}

export function registerTokenPageBrandingRoutes(app: Express): void {
  app.options('/api/tokens/:token/dex-branding', (req, res) => {
    setCorsRead(req, res);
    res.status(204).end();
  });

  app.get('/api/tokens/:token/dex-branding', async (req: Request, res: Response) => {
    setCorsRead(req, res);
    const token = parseToken(typeof req.params.token === 'string' ? req.params.token : '');
    if (!token) {
      res.status(400).json({ error: 'Invalid token address.' });
      return;
    }

    try {
      const row = await getDeploymentByTokenAddress(token);
      if (!row) {
        res.status(404).json({ error: 'Token not found in hood.markets catalog.' });
        return;
      }

      const [dex, admin] = await Promise.all([
        fetchDexBrandingProfile(token),
        resolveTokenPageAdmin(row),
      ]);

      const wallet =
        typeof req.query.wallet === 'string' ? req.query.wallet.trim() : '';
      const isAdmin = wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)
        ? walletIsTokenPageAdmin(wallet, admin)
        : false;

      res.json({
        tokenAddress: token,
        catalogImageUrl: row.tokenImageUrl || null,
        catalogBannerUrl: row.tokenBannerUrl || null,
        dex,
        displayImageUrl:
          row.tokenImageUrl?.trim() ||
          (dex.enhancedInfoPaid ? dex.iconUrl : null) ||
          null,
        displayBannerUrl:
          row.tokenBannerUrl?.trim() ||
          (dex.enhancedInfoPaid ? dex.bannerUrl : null) ||
          null,
        admin,
        isAdmin,
      });
    } catch {
      res.status(500).json({ error: 'Failed to load Dex branding.' });
    }
  });

  app.options('/api/tokens/:token/import-dex-branding', (req, res) => {
    setCorsWrite(req, res);
    res.status(204).end();
  });

  app.post('/api/tokens/:token/import-dex-branding', async (req: Request, res: Response) => {
    setCorsWrite(req, res);
    const token = parseToken(typeof req.params.token === 'string' ? req.params.token : '');
    if (!token) {
      res.status(400).json({ error: 'Invalid token address.' });
      return;
    }

    const walletAddress =
      typeof req.body?.walletAddress === 'string' ? req.body.walletAddress.trim() : '';
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      res.status(400).json({ error: 'walletAddress must be a valid 0x address.' });
      return;
    }

    try {
      const session = await verifyWebSessionBearer(req.headers.authorization);
      if (session.kind !== 'wallet' || session.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: 'Sign in with the admin wallet to import Dex branding.' });
        return;
      }

      const row = await getDeploymentByTokenAddress(token);
      if (!row) {
        res.status(404).json({ error: 'Token not found in hood.markets catalog.' });
        return;
      }

      const admin = await resolveTokenPageAdmin(row);
      if (!walletIsTokenPageAdmin(walletAddress, admin)) {
        res.status(403).json({
          error: 'Only the token page admin can import Dex branding.',
          adminWallet: admin.adminWallet,
          adminRole: admin.adminRole,
        });
        return;
      }

      const dex = await fetchDexBrandingProfile(token);
      if (!dex.enhancedInfoPaid) {
        res.status(400).json({
          error: 'DexScreener Enhanced Token Info is not paid for this token yet.',
          enhancedInfoStatus: dex.enhancedInfoStatus,
        });
        return;
      }

      const patch: { tokenImageUrl?: string; tokenBannerUrl?: string } = {};
      if (dex.iconUrl) patch.tokenImageUrl = dex.iconUrl;
      if (dex.bannerUrl) patch.tokenBannerUrl = dex.bannerUrl;

      if (!patch.tokenImageUrl && !patch.tokenBannerUrl) {
        res.status(400).json({
          error: 'DexScreener has no icon or banner available for this token yet.',
        });
        return;
      }

      const ok = await updateDeploymentCatalogBranding(token, patch);
      if (!ok) {
        res.status(500).json({ error: 'Failed to save branding to catalog.' });
        return;
      }

      const updated = await enrichDeploymentForPublicApi(await getDeploymentByTokenAddress(token));
      res.json({
        ok: true,
        imported: patch,
        token: updated,
        dex,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      const status = /authorization|bearer/i.test(msg) ? 401 : 500;
      res.status(status).json({ error: msg });
    }
  });
}
