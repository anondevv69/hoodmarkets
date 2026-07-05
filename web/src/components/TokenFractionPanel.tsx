import { usePrivy, useWallets } from '@privy-io/react-auth';
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
import { TokenFractionShareActions } from './TokenFractionShareActions';
import { TokenFractionListings } from './TokenFractionListings';

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
  const { authenticated, login } = usePrivy();
  const wallet = wallets[0];
  const walletAddress = wallet?.address;
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
        const row = await fetchTokenFractionInfo(tokenAddress, { fromBlock, factoryAddress });
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

  async function refreshFractionState(collectionAddress: `0x${string}`) {
    const fromBlock = deployBlockNumber ? BigInt(deployBlockNumber) : undefined;
    const [row, shares] = await Promise.all([
      fetchTokenFractionInfo(tokenAddress, { fromBlock, factoryAddress }),
      walletAddress
        ? fetchWalletFractionBalance(
            collectionAddress,
            walletAddress as `0x${string}`,
            info?.tokenId ?? 0,
          )
        : Promise.resolve(null),
    ]);
    setInfo(row);
    if (shares != null) setWalletShares(shares);
  }

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
          {info.totalShares.toLocaleString()} equal shares · 10% supply vaulted ·{' '}
          <strong>95% trading fees split pro-rata</strong> by share count
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

      <p className="muted token-space-note token-fraction-public-note">
        Vault shares are public on-chain. Anyone can view holders; connect a wallet that holds shares
        to send, list for sale on-chain, exit the vault, or trigger a fee claim for all holders.
      </p>

      <div className="token-fraction-layout">
        <div className="token-fraction-stats token-fraction-stats--wide">
          <div className="token-fraction-stat">
            <span className="token-fraction-stat-k">Outstanding</span>
            <span className="token-fraction-stat-v">{info.outstandingShares.toLocaleString()}</span>
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

        <div className="token-fraction-layout-meta">
          {walletShares != null && walletShares > 0 ? (
            <p className="token-fraction-wallet">
              Your wallet holds{' '}
              <strong>
                {walletShares.toLocaleString()} share{walletShares === 1 ? '' : 's'}
              </strong>{' '}
              ({pctLabel((walletShares / info.totalShares) * 100)} of vault · same % of creator fees)
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
        </div>

        {(isFeeRecipientWallet || (walletShares != null && walletShares > 0)) &&
        authenticated &&
        wallet &&
        walletShares != null &&
        walletShares > 0 ? (
          <div className="token-fraction-manage token-fraction-layout-actions">
            <p className="token-fraction-manage-title">
              {isFeeRecipientWallet ? 'You received the launch shares' : 'You hold shares'}
            </p>
            <TokenFractionShareActions
              info={info}
              wallet={wallet}
              walletShares={walletShares}
              deployBlockNumber={deployBlockNumber}
              shareTokenHuman={shareTokenHuman}
              onRefresh={() => refreshFractionState(info.collectionAddress)}
            />
          </div>
        ) : authenticated && wallet && (isFeeRecipientWallet || walletShares === 0) ? (
          <p className="muted token-fraction-viewer-note">
            Your connected wallet does not hold shares for this token.
          </p>
        ) : null}

        <div className="token-fraction-layout-table">
          <TokenFractionListings
            collectionAddress={info.collectionAddress}
            wallet={authenticated && wallet ? wallet : null}
            authenticated={authenticated}
            onLogin={login}
            onRefresh={() => refreshFractionState(info.collectionAddress)}
          />

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
        </div>

        <p className="muted token-fraction-foot">
          Shares are ERC-1155 tokens — transferable like NFTs. All 1,000 mint to the fee recipient at
          launch. Hold shares to earn trading fees pro-rata, or list shares for sale on-chain (
          <code>listShares</code> / <code>buyShares</code> — 5% platform fee on sales and wallet sends). Burn shares to withdraw launch tokens from
          the 10% vault (you forfeit fee rights on burned shares). Anyone can call{' '}
          <code>claimTradingFees()</code> once to pay every holder.
        </p>

        {!authenticated ? (
          <p className="muted token-fraction-viewer-note token-fraction-signin-foot">
            <button type="button" className="btn btn-ghost btn-sm" onClick={login}>
              Sign in
            </button>{' '}
            to send, redeem, or claim from a wallet that holds shares.
          </p>
        ) : null}
      </div>
    </section>
  );
}
