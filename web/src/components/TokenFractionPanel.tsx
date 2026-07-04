import { useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { addressUrl, shortenAddress, tokenUrl } from '../chain';
import { openWalletProfile } from '../lib/deployerProfileRoute';
import { formatTokenBalance } from '../lib/formatTokenBalance';
import { isSimpleLaunchDeployment } from '../lib/launchType';
import {
  fetchTokenFractionInfo,
  fetchWalletFractionBalance,
  type TokenFractionInfo,
} from '../lib/tokenFractions';

function pctLabel(n: number): string {
  if (n >= 10) return `${n.toFixed(1)}%`;
  if (n >= 1) return `${n.toFixed(2)}%`;
  return `${n.toFixed(3)}%`;
}

export function TokenFractionPanel({
  tokenAddress,
  factoryAddress,
  poolId,
  deployBlockNumber,
  feeRecipientAddress,
}: {
  tokenAddress: string;
  factoryAddress?: string | null;
  poolId?: string | null;
  deployBlockNumber?: string | null;
  feeRecipientAddress?: string | null;
}) {
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address;
  const [info, setInfo] = useState<TokenFractionInfo | null>(null);
  const [walletShares, setWalletShares] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSimple = isSimpleLaunchDeployment({ poolId, factoryAddress });

  useEffect(() => {
    if (!isSimple) {
      setLoading(false);
      setInfo(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const fromBlock = deployBlockNumber ? BigInt(deployBlockNumber) : undefined;
        const row = await fetchTokenFractionInfo(tokenAddress, { fromBlock });
        if (cancelled) return;
        setInfo(row);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load holder NFTs.');
          setInfo(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenAddress, isSimple, deployBlockNumber]);

  useEffect(() => {
    if (!info?.collectionAddress || !walletAddress) {
      setWalletShares(null);
      return;
    }
    let cancelled = false;
    void fetchWalletFractionBalance(info.collectionAddress, walletAddress as `0x${string}`, info.tokenId)
      .then((n) => {
        if (!cancelled) setWalletShares(n);
      })
      .catch(() => {
        if (!cancelled) setWalletShares(null);
      });
    return () => {
      cancelled = true;
    };
  }, [info?.collectionAddress, info?.tokenId, walletAddress]);

  if (!isSimple) return null;
  if (loading) {
    return (
      <section className="tp-zone tp-fraction-zone" aria-labelledby="fraction-heading">
        <p id="fraction-heading" className="tp-zone-label">
          Holder NFTs
        </p>
        <p className="muted token-fraction-note">Loading 1000-share vault…</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="tp-zone tp-fraction-zone" aria-labelledby="fraction-heading">
        <p id="fraction-heading" className="tp-zone-label">
          Holder NFTs
        </p>
        <p className="error token-fraction-note">{error}</p>
      </section>
    );
  }
  if (!info) return null;

  const shareTokenHuman = formatTokenBalance(info.tokensPerShare, 18);
  const feeRecipientLower = feeRecipientAddress?.trim().toLowerCase();
  const walletLower = walletAddress?.toLowerCase();
  const isFeeRecipientWallet =
    !!feeRecipientLower && !!walletLower && feeRecipientLower === walletLower;
  const feeRecipientHolder = feeRecipientLower
    ? info.holders.find((h) => h.address.toLowerCase() === feeRecipientLower)
    : undefined;

  return (
    <section className="tp-zone tp-fraction-zone" aria-labelledby="fraction-heading">
      <div className="token-fraction-head">
        <p id="fraction-heading" className="tp-zone-label">
          Holder NFTs
        </p>
        <p className="token-fraction-sub">
          {info.totalShares.toLocaleString()} equal shares · 10% supply vaulted · minted to the fee
          recipient at launch
        </p>
      </div>

      {feeRecipientAddress ? (
        <p className="token-fraction-recipient muted">
          Launch recipient:{' '}
          <button
            type="button"
            className="token-fraction-holder lp-mono"
            onClick={() => openWalletProfile(feeRecipientAddress)}
          >
            {shortenAddress(feeRecipientAddress)}
          </button>
          {feeRecipientHolder ? (
            <>
              {' '}
              · holds {feeRecipientHolder.shares.toLocaleString()} share
              {feeRecipientHolder.shares === 1 ? '' : 's'}
            </>
          ) : null}
        </p>
      ) : null}

      {(isFeeRecipientWallet || (walletShares != null && walletShares > 0)) ? (
        <div className="token-fraction-manage">
          <p className="token-fraction-manage-title">
            {isFeeRecipientWallet ? 'You received the launch shares' : 'You hold shares'}
          </p>
          <ul className="token-fraction-manage-list">
            <li>Sell or list on NFT marketplaces (ERC-1155 transfer)</li>
            <li>Gift or airdrop shares to any wallet</li>
            <li>Reward early buyers — send shares to their wallets after they trade</li>
            <li>Redeem on-chain via the collection contract to receive underlying tokens</li>
          </ul>
        </div>
      ) : null}

      <div className="token-fraction-stats">
        <div className="token-fraction-stat">
          <span className="token-fraction-stat-k">Outstanding</span>
          <span className="token-fraction-stat-v">{info.outstandingShares.toLocaleString()}</span>
        </div>
        <div className="token-fraction-stat">
          <span className="token-fraction-stat-k">Redeemed</span>
          <span className="token-fraction-stat-v">{info.redeemedShares.toLocaleString()}</span>
        </div>
        <div className="token-fraction-stat">
          <span className="token-fraction-stat-k">Holders</span>
          <span className="token-fraction-stat-v">{info.holderCount.toLocaleString()}</span>
        </div>
        <div className="token-fraction-stat">
          <span className="token-fraction-stat-k">Per share</span>
          <span className="token-fraction-stat-v">{shareTokenHuman}</span>
        </div>
      </div>

      {walletShares != null && walletShares > 0 ? (
        <p className="token-fraction-wallet">
          Your wallet holds{' '}
          <strong>
            {walletShares.toLocaleString()} share{walletShares === 1 ? '' : 's'}
          </strong>{' '}
          ({pctLabel((walletShares / info.totalShares) * 100)} of vault)
        </p>
      ) : null}

      <div className="token-fraction-links">
        <a href={tokenUrl(info.collectionAddress)} target="_blank" rel="noreferrer">
          View collection on Blockscout
        </a>
        <span className="tp-meta-dot">·</span>
        <a href={addressUrl(info.collectionAddress)} target="_blank" rel="noreferrer" className="lp-mono">
          {shortenAddress(info.collectionAddress)}
        </a>
      </div>

      {info.holders.length > 0 ? (
        <div className="token-fraction-table-wrap">
          <table className="token-fraction-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Holder</th>
                <th scope="col">Shares</th>
                <th scope="col">Vault %</th>
              </tr>
            </thead>
            <tbody>
              {info.holders.map((h, i) => (
                <tr key={h.address}>
                  <td>{i + 1}</td>
                  <td>
                    <button
                      type="button"
                      className="token-fraction-holder lp-mono"
                      onClick={() => openWalletProfile(h.address)}
                    >
                      {shortenAddress(h.address)}
                    </button>
                  </td>
                  <td>{h.shares.toLocaleString()}</td>
                  <td>{pctLabel(h.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted token-fraction-note">No outstanding shares — full vault redeemed.</p>
      )}

      <p className="muted token-fraction-foot">
        Shares are standard ERC-1155 tokens — transferable like NFTs. The fee recipient receives
        all 1,000 at launch (including when someone else launches for them). Holders call{' '}
        <code>redeem(amount)</code> on the collection contract to burn shares and receive underlying
        tokens.
      </p>
    </section>
  );
}
