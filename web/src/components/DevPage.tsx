import { useEffect } from 'react';
import { addressUrl } from '../chain';

const SDK_REPO = 'https://github.com/anondevv69/hoodmarkets-sdk';
const SDK_MD = '/sdk.md';
const CONTRACTS_REPO = 'https://github.com/anondevv69/hoodmarkets/tree/main/contracts';
const AGENT_SKILL = 'https://github.com/anondevv69/hoodmarkets/tree/main/skills/hoodmarkets';
const API_BASE = 'https://api.hood.markets';

const CONTRACTS = [
  { name: 'HoodMarketsV3 factory (v0.10.0)', address: '0xf65536Eb3354Ad7e77E1b0d0F7bEBFa1C88885C9' },
  { name: 'HoodMarketsV3 vault', address: '0xB38BC03B373e7dFD43727A5f6aF3b588b441121b' },
  { name: 'HoodMarketsV3 LP locker', address: '0x3e51b0D25AA990d2e6C17b29D644F8eb0Ed2913A' },
  { name: 'HoodMarketsV3 fraction deployer', address: '0x6542CdAaBdD69E3c830b162bB7946d24bcdA156c' },
  { name: 'Platform fee wallet (5%)', address: '0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98' },
  { name: 'WETH', address: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' },
  { name: 'Uniswap V3 SwapRouter02', address: '0xCaf681a66D020601342297493863E78C959E5cb2' },
] as const;

const AGENT_ENDPOINTS = [
  ['GET', '/health', 'API + chainId 4663'],
  ['GET', '/api/agent/briefing?wallet=0x…', 'Tokens where wallet is fee recipient'],
  ['GET', '/api/agent/preflight-deploy?…&launchMode=simple', 'Preflight before deploy'],
  ['GET', '/api/agent/token-info?token=0x…', 'Token metadata + Uniswap trade link'],
  ['POST', '/api/deploy', 'Deploy token (X-Agent-Captcha-JWT header)'],
  ['POST', '/api/agent/claim', 'Claim fees (launcher pays gas)'],
  ['GET', '/api/deployments?limit=50', 'Public token catalog'],
] as const;

function scrollToHash(): void {
  const id = window.location.hash.replace(/^#/, '');
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function DevPage() {
  useEffect(() => {
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, []);

  return (
    <div className="dev-page">
      <p className="dev-lead dev-intro">
        Reference for on-chain contracts, the TypeScript SDK, and the agent API — everything you need
        to build on hood.markets outside the web UI.
      </p>
      <nav className="dev-nav" aria-label="Dev sections">
        <a href="#contracts" className="dev-nav-link">
          Contracts
        </a>
        <a href="#sdk" className="dev-nav-link">
          SDK
        </a>
        <a href="#agent" className="dev-nav-link">
          Agent API
        </a>
      </nav>

      <section id="contracts" className="dev-section lp-card">
        <h2 className="dev-section-title">Contracts</h2>
        <p className="dev-lead">
          All hood.markets tokens deploy through <strong>HoodMarkets V3</strong> — Uniswap V3 pools on
          Robinhood Chain (4663). Fee split: <strong>95%</strong> to your fee recipient ·{' '}
          <strong>5%</strong> platform (on-chain in locker).
        </p>
        <div className="dev-table-wrap">
          <table className="dev-table">
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
                    <a className="dev-mono dev-link" href={addressUrl(row.address)} target="_blank" rel="noreferrer">
                      {row.address}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dev-foot">
          Foundry source:{' '}
          <a className="dev-link" href={CONTRACTS_REPO} target="_blank" rel="noreferrer">
            github.com/anondevv69/hoodmarkets/contracts
          </a>
          {' · '}
          Agent reference:{' '}
          <a className="dev-link" href={SDK_MD} target="_blank" rel="noreferrer">
            sdk.md
          </a>
        </p>
      </section>

      <section id="sdk" className="dev-section lp-card">
        <h2 className="dev-section-title">SDK</h2>
        <p className="dev-lead">
          Deploy from your own site or script — same on-chain contracts as hood.markets.
        </p>
        <div className="dev-links-row">
          <a className="dev-pill" href={SDK_REPO} target="_blank" rel="noreferrer">
            hoodmarkets-sdk (GitHub)
          </a>
          <a className="dev-pill" href={SDK_MD} target="_blank" rel="noreferrer">
            sdk.md
          </a>
        </div>
        <p className="dev-foot">
          Copy <a className="dev-link" href={SDK_MD} target="_blank" rel="noreferrer">sdk.md</a> for your agent — contract
          addresses, SDK install, and integration paths in one file.
        </p>
        <pre className="dev-code">{`npm install github:anondevv69/hoodmarkets-sdk viem

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
        <p className="dev-foot">
          CLI (from GitHub):{' '}
          <code className="dev-inline">npx github:anondevv69/hoodmarkets-sdk deploy --name "My Token" --symbol "MTK" --image "ipfs://…"</code>
        </p>
      </section>

      <section id="agent" className="dev-section lp-card">
        <h2 className="dev-section-title">Agent API</h2>
        <p className="dev-lead">
          Any agent with an EVM wallet can deploy and claim through{' '}
          <a className="dev-link dev-mono" href={API_BASE} target="_blank" rel="noreferrer">
            {API_BASE}
          </a>
          . Use POST on the API host only — not hood.markets.
        </p>
        <div className="dev-table-wrap">
          <table className="dev-table">
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
                    <span className={`dev-method dev-method--${method.toLowerCase()}`}>{method}</span>
                  </td>
                  <td className="dev-mono">{path}</td>
                  <td>{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <pre className="dev-code">{`# Deploy (after haiku JWT or X channel auth)
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
        <p className="dev-foot">
          Bankr skill:{' '}
          <a className="dev-link" href={AGENT_SKILL} target="_blank" rel="noreferrer">
            skills/hoodmarkets
          </a>
          {' · '}
          Raw reference: <a className="dev-link" href="/agent.md" target="_blank" rel="noreferrer">agent.md</a>
        </p>
      </section>
    </div>
  );
}
