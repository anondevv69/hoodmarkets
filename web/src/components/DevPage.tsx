import { useEffect } from 'react';
import { addressUrl } from '../chain';

const MONOREPO = 'https://github.com/anondevv69/hoodmarkets';
const V3_JSON = `${MONOREPO}/blob/main/contracts/deployed-hoodmarkets-v3-mainnet.json`;
const V3_DOCS = `${MONOREPO}/blob/main/docs/HOODMARKETS_V3.md`;

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
        <a href="#capabilities" className="dev-nav-link">
          Capabilities
        </a>
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

      <section id="capabilities" className="dev-section lp-card">
        <h2 className="dev-section-title">What you can do</h2>
        <p className="dev-lead">
          Platform fees in <strong>two places only</strong>: swap trading fees (5% / 95% to Holder NFT
          holders) and share marketplace sales (5% of listed price on <code>buyShares</code>). Sends and
          batch airdrops are free. Web launch “Someone else” fee recipient = <code>0x…</code> wallet only.
        </p>
        <div className="dev-table-wrap">
          <table className="dev-table">
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
        <p className="dev-foot">
          Full reference:{' '}
          <a className="dev-link" href={SDK_MD} target="_blank" rel="noreferrer">
            sdk.md
          </a>
          {' · '}
          <a className="dev-link" href={V3_DOCS} target="_blank" rel="noreferrer">
            HOODMARKETS_V3.md
          </a>
        </p>
      </section>

      <section id="contracts" className="dev-section lp-card">
        <h2 className="dev-section-title">Contracts (v0.11.0)</h2>
        <p className="dev-lead">
          HoodMarkets V3 on Robinhood mainnet — each simple launch embeds a 1,000-share Holder NFT vault
          (10% of supply). JSON:{' '}
          <a className="dev-link" href={V3_JSON} target="_blank" rel="noreferrer">
            deployed-hoodmarkets-v3-mainnet.json
          </a>
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
          Legacy V3 factories (v0.10, v0.9, v0.8, …) remain valid for existing catalog tokens — see{' '}
          <a className="dev-link" href={`${MONOREPO}/blob/main/skills/hoodmarkets/known-contracts.json`} target="_blank" rel="noreferrer">
            known-contracts.json
          </a>
          . Foundry source:{' '}
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
