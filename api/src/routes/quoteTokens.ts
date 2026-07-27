import type { Express, Request, Response } from 'express';
import { listRobinhoodQuoteTokens } from '../lib/robinhoodQuoteTokens.js';
import { webDeployCorsHeadersRead } from '../lib/webDeployCors.js';

function corsRead(req: Request, res: Response): void {
  const h = webDeployCorsHeadersRead(req.headers.origin);
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
}

export function registerQuoteTokenRoutes(app: Express): void {
  app.options('/api/quote-tokens', (req, res) => {
    corsRead(req, res);
    res.status(204).end();
  });

  app.get('/api/quote-tokens', async (req: Request, res: Response) => {
    corsRead(req, res);
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const checkLiquidity =
      req.query.liquidity === '1' ||
      req.query.liquidity === 'true' ||
      req.query.checkLiquidity === '1';

    try {
      const tokens = await listRobinhoodQuoteTokens({ refresh, checkLiquidity: checkLiquidity });
      res.json({
        chainId: 4663,
        count: tokens.length,
        tokens: tokens.map((t) => ({
          symbol: t.symbol,
          name: t.name,
          address: t.address,
          kind: t.kind,
          logoUrl: t.logoUrl,
          usdPrice: t.usdPrice,
          wethPoolFee: t.wethPoolFee,
          hasWethLiquidity: t.hasWethLiquidity,
        })),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load quote tokens.';
      res.status(502).json({ error: msg });
    }
  });
}
