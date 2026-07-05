import { useEffect } from 'react';
import { addressUrl } from '../chain';
import { type DevSection, normalizeDevSection } from '../lib/devRoute';

const MONOREPO = 'https://github.com/anondevv69/hoodmarkets';
const V3_JSON = `${MONOREPO}/blob/main/contracts/deployed-hoodmarkets-v3-mainnet.json`;
const V3_DOCS = `${MONOREPO}/blob/main/docs/HOODMARKETS_V3.md`;
const SETUP_DOCS = `${MONOREPO}/blob/main/docs/HOOD_MARKETS_SETUP.md`;

const CAPABILITIES = [
  ['Deploy token', 'SDK, factory, or POST /api/deploy'],
  ['Buy / sell token', 'Uniswap on Robinhood — launch LP is locked'],
  ['Holder NFT shares', '1,000 shares per launch; send, one-tx airdrop, list, redeem'],
  ['Buyer rewards', 'Post-launch on token page — fundBuyerRewardPool (not at deploy)'],
  ['Claim swap fees', 'claimTradingFees() — pro-rata to all share holders'],
  ['Share marketplace', 'listShares / buyShares — 5% platform on sale price only'],
  ['Agent automation', 'api.hood.markets — deploy, claim, catalog'],
] as const;

const CONTRACTS = [
  { name: 'HoodMarketsV3 factory (v0.11.0)', address: '0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5' },
  { name: 'HoodMarketsV3 vault', address: '0x856c6997A86752fB3E6A494AB93107B7A371A57f' },
  { name: 'HoodMarketsV3 LP locker', address: '0x23a1c52F4E93B0283d12CC16c29Df119803E8745' },
  { name: 'HoodMarketsV3 fraction deployer', address: '0x40A19d561b3200A2C9E1014248FcEB724c450692' },
  { name: 'Platform fee wallet (5%)', address: '0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98' },
  { name: 'WETH', address: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' },
  { name: 'Uniswap V3 SwapRouter02', address: '0xCaf681a66D020601342297493863E78C959E5cb2' },
] as const;

const SDK_REPO = 'https://github.com/anondevv69/hoodmarkets-sdk';
const SDK_MD = '/sdk.md';
const CONTRACTS_REPO = 'https://github.com/anondevv69/hoodmarkets/tree/main/contracts';
const AGENT_SKILL = 'https://github.com/anondevv69/hoodmarkets/tree/main/skills/hoodmarkets';
const AGENT_API_REF = `${MONOREPO}/blob/main/skills/hoodmarkets/references/AGENT-API.md`;
const KNOWN_CONTRACTS = `${MONOREPO}/blob/main/skills/hoodmarkets/known-contracts.json`;
const API_BASE = 'https://api.hood.markets';

const AGENT_ENDPOINTS = [
  ['GET', '/health', 'API + chainId 4663'],
  ['GET', '/api/agent/briefing?wallet=0x…', 'Tokens where wallet is fee recipient'],
  ['GET', '/api/agent/preflight-deploy?…&launchMode=simple', 'Preflight before deploy'],
  ['GET', '/api/agent/token-info?token=0x…', 'Token metadata + Uniswap trade link'],
  ['POST', '/api/deploy', 'Deploy token (X-Agent-Captcha-JWT header)'],
  ['POST', '/api/agent/claim', 'Claim fees (launcher pays gas)'],
  ['POST', '/api/agent/claim-for-recipient', 'Claim for any catalog token (no JWT)'],
  ['GET', '/api/deployments?limit=50', 'Public token catalog'],
] as const;

const GITHUB_LINKS = [
  {
    title: 'Monorepo',
    desc: 'Web app, API, contracts, and agent skill',
    href: MONOREPO,
    label: 'anondevv69/hoodmarkets',
  },
  {
    title: 'TypeScript SDK',
    desc: 'Deploy and interact from your own site or script',
    href: SDK_REPO,
    label: 'anondevv69/hoodmarkets-sdk',
  },
  {
    title: 'Contracts',
    desc: 'Foundry source, deploy scripts, and ABIs',
    href: CONTRACTS_REPO,
    label: 'hoodmarkets/contracts',
  },
  {
    title: 'Agent skill',
    desc: 'Bankr skill + references for autonomous agents',
    href: AGENT_SKILL,
    label: 'skills/hoodmarkets',
  },
  {
    title: 'sdk.md',
    desc: 'Contracts, SDK install, and integration paths',
    href: SDK_MD,
    label: 'hood.markets/sdk.md',
  },
  {
    title: 'agent.md',
    desc: 'Agent API endpoints, auth, and examples',
    href: '/agent.md',
    label: 'hood.markets/agent.md',
  },
] as const;

const SIDEBAR: { id: DevSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'fees', label: 'Platform fees' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'sdk', label: 'SDK' },
  { id: 'agents', label: 'Agents' },
  { id: 'github', label: 'GitHub & resources' },
  { id: 'faq', label: 'FAQ' },
];

const FAQ = [
  {
    q: 'How much does it cost to launch a token?',
    a: 'You pay Robinhood network gas for deploy and trades. The launcher wallet covers gas on agent deploy and fee claims through api.hood.markets.',
  },
  {
    q: 'Where does the 5% platform fee apply?',
    a: 'Only on Uniswap swap fee claims (5% / 95% split) and share marketplace sales via buyShares. Sends and batch airdrops have no platform fee in v0.11.',
  },
  {
    q: 'How do agents deploy and claim?',
    a: 'POST to api.hood.markets with an X-Agent-Captcha-JWT (haiku) or X channel auth. See the Agents section and agent.md for full endpoint reference.',
  },
  {
    q: 'Can I deploy from my own website?',
    a: 'Yes — use the hoodmarkets-sdk npm package or call the factory contract directly. Same on-chain contracts as hood.markets.',
  },
  {
    q: 'Are older factory versions still valid?',
    a: 'Yes. Legacy V3 factories (v0.10, v0.9, v0.8, …) remain valid for existing catalog tokens. See known-contracts.json for the full list.',
  },
] as const;

function scrollToHash(): void {
  const raw = window.location.hash.replace(/^#/, '');
  const id = normalizeDevSection(raw) ?? raw;
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function DocsSidebarLink({ id, label }: { id: DevSection; label: string }) {
  return (
    <a href={`#${id}`} className="docs-sidebar-link">
      {label}
    </a>
  );
}

export function DevPage() {
  useEffect(() => {
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, []);

  return (
    <div className="docs-page">
      <header className="docs-hero lp-card">
        <p className="docs-eyebrow">Documentation</p>
        <h1 className="docs-hero-title lp-display">How hood.markets Works</h1>
        <p className="docs-hero-lead">
          Open token infrastructure on Robinhood Chain — launch in seconds, trade on Uniswap, and
          earn swap fees through Holder NFT shares. Build with the SDK, wire up agents, or integrate
          the contracts directly.
        </p>
        <div className="docs-hero-actions">
          <a className="docs-hero-btn docs-hero-btn--primary" href="/?tab=launch">
            Launch a token
          </a>
          <a className="docs-hero-btn" href="/">
            Browse tokens
          </a>
        </div>
        <div className="docs-stat-grid">
          <div className="docs-stat">
            <span className="docs-stat-value">Seconds</span>
            <span className="docs-stat-label">Time to launch</span>
            <span className="docs-stat-hint">No code required on web</span>
          </div>
          <div className="docs-stat">
            <span className="docs-stat-value">1,000</span>
            <span className="docs-stat-label">Holder NFT shares</span>
            <span className="docs-stat-hint">10% of supply per launch</span>
          </div>
          <div className="docs-stat">
            <span className="docs-stat-value">Open</span>
            <span className="docs-stat-label">Infrastructure</span>
            <span className="docs-stat-hint">SDK, API, and contracts</span>
          </div>
        </div>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar" aria-label="On this page">
          <p className="docs-sidebar-title">On this page</p>
          <nav className="docs-sidebar-nav">
            {SIDEBAR.map((item) => (
              <DocsSidebarLink key={item.id} id={item.id} label={item.label} />
            ))}
          </nav>
        </aside>

        <div className="docs-main">
          <section id="overview" className="docs-section lp-card">
            <p className="docs-section-eyebrow">Overview</p>
            <h2 className="docs-section-title">What is hood.markets</h2>
            <p className="docs-lead">
              hood.markets is a token launchpad and open protocol on Robinhood Chain (4663). Anyone
              can launch a token from the web UI, the TypeScript SDK, or the agent API — every simple
              launch embeds a 1,000-share Holder NFT vault so fee recipients earn swap fees
              pro-rata.
            </p>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>How</th>
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITIES.map(([action, how]) => (
                    <tr key={action}>
                      <td>{action}</td>
                      <td>{how}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="fees" className="docs-section lp-card">
            <p className="docs-section-eyebrow">Economics</p>
            <h2 className="docs-section-title">Platform fees</h2>
            <p className="docs-lead">
              Platform fees apply in <strong>two places only</strong>. Sends, batch airdrops, listing
              escrow, and buyer-reward mints are free in v0.11.
            </p>
            <div className="docs-fee-grid">
              <div className="docs-fee-card">
                <span className="docs-fee-pct">5% / 95%</span>
                <h3 className="docs-fee-name">Swap trading fees</h3>
                <p className="docs-fee-desc">
                  On <code>claimTradingFees()</code> — 5% to hood.markets platform, 95% pro-rata to
                  Holder NFT share holders.
                </p>
              </div>
              <div className="docs-fee-card">
                <span className="docs-fee-pct">5%</span>
                <h3 className="docs-fee-name">Share marketplace</h3>
                <p className="docs-fee-desc">
                  On <code>buyShares</code> only — 5% of listed price to platform, 95% to seller.
                </p>
              </div>
            </div>
            <p className="docs-foot">
              Web launch “Someone else” fee recipient = <code>0x…</code> wallet only. Buyer rewards are
              funded post-launch on the token page.
            </p>
          </section>

          <section id="contracts" className="docs-section lp-card">
            <p className="docs-section-eyebrow">On-chain</p>
            <h2 className="docs-section-title">Contracts (v0.11.0)</h2>
            <p className="docs-lead">
              HoodMarkets V3 on Robinhood mainnet — each simple launch embeds a 1,000-share Holder NFT
              vault. JSON:{' '}
              <a className="docs-link" href={V3_JSON} target="_blank" rel="noreferrer">
                deployed-hoodmarkets-v3-mainnet.json
              </a>
            </p>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTRACTS.map((row) => (
                    <tr key={row.address}>
                      <td>{row.name}</td>
                      <td>
                        <a
                          className="docs-mono docs-link"
                          href={addressUrl(row.address)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {row.address}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="docs-foot">
              Deep reference:{' '}
              <a className="docs-link" href={V3_DOCS} target="_blank" rel="noreferrer">
                HOODMARKETS_V3.md
              </a>
              {' · '}
              Legacy factories:{' '}
              <a className="docs-link" href={KNOWN_CONTRACTS} target="_blank" rel="noreferrer">
                known-contracts.json
              </a>
            </p>
          </section>

          <section id="sdk" className="docs-section lp-card">
            <p className="docs-section-eyebrow">Integrate</p>
            <h2 className="docs-section-title">SDK</h2>
            <p className="docs-lead">
              Deploy from your own site or script — same on-chain contracts as hood.markets.
            </p>
            <div className="docs-links-row">
              <a className="docs-pill" href={SDK_REPO} target="_blank" rel="noreferrer">
                hoodmarkets-sdk (GitHub)
              </a>
              <a className="docs-pill" href={SDK_MD} target="_blank" rel="noreferrer">
                sdk.md
              </a>
            </div>
            <pre className="docs-code">{`npm install github:anondevv69/hoodmarkets-sdk viem

import { HoodMarkets, robinhood, ROBINHOOD_RPC_DEFAULT } from 'hoodmarkets-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';

const publicClient = createPublicClient({
  chain: robinhood,
  transport: http(ROBINHOOD_RPC_DEFAULT),
});
const wallet = createWalletClient({ account, chain: robinhood, transport: http(ROBINHOOD_RPC_DEFAULT) });

const hm = new HoodMarkets({ wallet, publicClient });
const result = await hm.deployToken({
  name: 'My Token',
  symbol: 'MTK',
  image: 'ipfs://…',
  feeRecipient: account.address,
});`}</pre>
            <p className="docs-foot">
              CLI:{' '}
              <code className="docs-inline">
                npx github:anondevv69/hoodmarkets-sdk deploy --name "My Token" --symbol "MTK" --image
                "ipfs://…"
              </code>
            </p>
          </section>

          <section id="agents" className="docs-section lp-card">
            <p className="docs-section-eyebrow">Automation</p>
            <h2 className="docs-section-title">Agents</h2>
            <p className="docs-lead">
              Any agent with an EVM wallet can deploy and claim through{' '}
              <a className="docs-link docs-mono" href={API_BASE} target="_blank" rel="noreferrer">
                {API_BASE}
              </a>
              . Use POST on the API host only — not hood.markets.
            </p>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENT_ENDPOINTS.map(([method, path, purpose]) => (
                    <tr key={path}>
                      <td>
                        <span className={`docs-method docs-method--${method.toLowerCase()}`}>
                          {method}
                        </span>
                      </td>
                      <td className="docs-mono">{path}</td>
                      <td>{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <pre className="docs-code">{`# Deploy (after haiku JWT or X channel auth)
POST ${API_BASE}/api/deploy
X-Agent-Captcha-JWT: <jwt>
Content-Type: application/json

{
  "name": "Token Name",
  "symbol": "SYM",
  "launchMode": "simple",
  "feeTarget": "agent_wallet",
  "clientKind": "agent"
}`}</pre>
            <p className="docs-foot">
              Bankr skill:{' '}
              <a className="docs-link" href={AGENT_SKILL} target="_blank" rel="noreferrer">
                skills/hoodmarkets
              </a>
              {' · '}
              Full reference:{' '}
              <a className="docs-link" href={AGENT_API_REF} target="_blank" rel="noreferrer">
                AGENT-API.md
              </a>
              {' · '}
              <a className="docs-link" href="/agent.md" target="_blank" rel="noreferrer">
                agent.md
              </a>
            </p>
          </section>

          <section id="github" className="docs-section lp-card">
            <p className="docs-section-eyebrow">Source</p>
            <h2 className="docs-section-title">GitHub & resources</h2>
            <p className="docs-lead">
              Everything is open source. Copy sdk.md or agent.md into your agent context, or browse
              the repos below.
            </p>
            <div className="docs-github-grid">
              {GITHUB_LINKS.map((link) => (
                <a
                  key={link.href}
                  className="docs-github-card"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="docs-github-card-title">{link.title}</span>
                  <span className="docs-github-card-desc">{link.desc}</span>
                  <span className="docs-github-card-label docs-mono">{link.label}</span>
                </a>
              ))}
            </div>
            <p className="docs-foot">
              Ops setup:{' '}
              <a className="docs-link" href={SETUP_DOCS} target="_blank" rel="noreferrer">
                HOOD_MARKETS_SETUP.md
              </a>
            </p>
          </section>

          <section id="faq" className="docs-section lp-card">
            <p className="docs-section-eyebrow">Questions</p>
            <h2 className="docs-section-title">FAQ</h2>
            <dl className="docs-faq">
              {FAQ.map((item) => (
                <div key={item.q} className="docs-faq-item">
                  <dt className="docs-faq-q">{item.q}</dt>
                  <dd className="docs-faq-a">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
