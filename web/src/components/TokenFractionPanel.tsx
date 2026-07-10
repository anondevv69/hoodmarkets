import { useWebAuth } from '../auth/WebAuthContext';
import { useActiveWallet } from '../hooks/useActiveWallet';
import { useEffect, useState } from 'react';
import { tokenUrl, shortenAddress } from '../chain';
import { openWalletProfile } from '../lib/deployerProfileRoute';
import { formatTokenBalance } from '../lib/formatTokenBalance';
import { isSimpleLaunchDeployment, supportsPostLaunchBuyerRewards } from '../lib/launchType';
import {
  fetchBuyerRewardAdmin,
  fetchTokenFractionInfo,
  fetchWalletFractionBalance,
  formatFractionLoadError,
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
  const wallet = useActiveWallet();
  const walletAddress = wallet?.address;
  const { authenticated, connectWallet } = useWebAuth();
  const [info, setInfo] = useState<TokenFractionInfo | null>(null);
  const [walletShares, setWalletShares] = useState<number | null>(null);
  const [buyerRewardAdmin, setBuyerRewardAdmin] = useState<string | null>(null);
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
          setError(formatFractionLoadError(e));
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
    if (!info?.collectionAddress) {
      setBuyerRewardAdmin(null);
      return;
    }
    let cancelled = false;
    void fetchBuyerRewardAdmin(info.collectionAddress)
      .then((admin) => {
        if (!cancelled) setBuyerRewardAdmin(admin);
      })
      .catch(() => {
        if (!cancelled) setBuyerRewardAdmin(null);
      });
    return () => {
      cancelled = true;
    };
  }, [info?.collectionAddress]);

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
  const buyerRewardAdminLower =
    buyerRewardAdmin?.toLowerCase() ?? feeRecipientAddress?.trim().toLowerCase() ?? null;
  const walletLower = walletAddress?.toLowerCase();
  const isBuyerRewardAdmin =
    !!buyerRewardAdminLower && !!walletLower && buyerRewardAdminLower === walletLower;
  const feeRecipientLower = feeRecipientAddress?.trim().toLowerCase();
  const feeRecipientHolder = feeRecipientLower
    ? info.holders.find((h) => h.address.toLowerCase() === feeRecipientLower)
    : undefined;
  const buyerRewardAdminHolder = buyerRewardAdminLower
    ? info.holders.find((h) => h.address.toLowerCase() === buyerRewardAdminLower)
    : undefined;
  const canFundBuyerRewards = supportsPostLaunchBuyerRewards(factoryAddress);

  return (
    <section className="tp-zone tp-fraction-zone" aria-labelledby="fraction-heading">
      <div className="token-fraction-head">
        <p id="fraction-heading" className="tp-zone-label">
          Holder NFTs
        </p>
        <p className="token-fraction-sub">
          {info.totalShares.toLocaleString()} equal shares · 10% supply vaulted
        </p>
      </div>

      {buyerRewardAdmin ? (
        <p className="token-fraction-recipient muted">
          Buyer-reward admin:{' '}
          <button
            type="button"
            className="token-fraction-holder lp-mono"
            onClick={() => openWalletProfile(buyerRewardAdmin)}
          >
            {shortenAddress(buyerRewardAdmin)}
          </button>
          {buyerRewardAdminHolder ? (
            <>
              {' '}
              · holds {buyerRewardAdminHolder.shares.toLocaleString()} share
              {buyerRewardAdminHolder.shares === 1 ? '' : 's'}
            </>
          ) : null}
        </p>
      ) : feeRecipientAddress ? (
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

      <p className="token-fraction-recipient muted">
        <a
          className="token-fraction-explorer lp-mono"
          href={tokenUrl(info.collectionAddress)}
          target="_blank"
          rel="noreferrer"
        >
          {shortenAddress(info.collectionAddress)}
        </a>
      </p>

      <div className="token-fraction-layout">
        <div className="token-fraction-stats token-fraction-stats--wide token-fraction-stats--inline">
          <div className="token-fraction-stat">
            <span className="token-fraction-stat-k">Outstanding</span>
            <span className="token-fraction-stat-v">{info.outstandingShares.toLocaleString()}</span>
          </div>
          <span className="token-fraction-stat-sep" aria-hidden>
            ·
          </span>
          <div className="token-fraction-stat">
            <span className="token-fraction-stat-k">Holders</span>
            <span className="token-fraction-stat-v">{info.holderCount.toLocaleString()}</span>
          </div>
          <span className="token-fraction-stat-sep" aria-hidden>
            ·
          </span>
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

        {(isBuyerRewardAdmin || (walletShares != null && walletShares > 0)) &&
        authenticated &&
        wallet &&
        walletShares != null &&
        walletShares > 0 ? (
          <div className="token-fraction-manage token-fraction-layout-actions">
            <p className="token-fraction-manage-title">
              {isBuyerRewardAdmin ? 'You received the launch shares' : 'You hold shares'}
            </p>
            <TokenFractionShareActions
              info={info}
              wallet={wallet}
              walletShares={walletShares}
              deployBlockNumber={deployBlockNumber}
              shareTokenHuman={shareTokenHuman}
              isFeeRecipient={isBuyerRewardAdmin}
              buyerRewardAdmin={buyerRewardAdmin ?? feeRecipientAddress ?? null}
              canFundBuyerRewards={canFundBuyerRewards}
              onRefresh={() => refreshFractionState(info.collectionAddress)}
            />
          </div>
        ) : authenticated && wallet && (isBuyerRewardAdmin || walletShares === 0) ? (
          <p className="muted token-fraction-viewer-note">
            Your connected wallet does not hold shares for this token.
          </p>
        ) : null}

        <div className="token-fraction-layout-table">
          <TokenFractionListings
            collectionAddress={info.collectionAddress}
            wallet={authenticated && wallet ? wallet : null}
            onRefresh={() => refreshFractionState(info.collectionAddress)}
          />

          {info.holders.length > 0 ? (
            <>
              <p className="token-fraction-table-label muted">Holders</p>
              <div className="token-fraction-table-wrap token-fraction-table-wrap--scroll">
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
            </>
          ) : (
            <p className="muted token-fraction-note">No outstanding shares — full vault redeemed.</p>
          )}
        </div>

        {!authenticated ? (
          <p className="muted token-fraction-viewer-note token-fraction-signin-foot">
            <button type="button" className="btn btn-ghost btn-sm" onClick={connectWallet}>
              Sign in
            </button>{' '}
            to buy shares or cancel your listings, send, redeem, or claim from a wallet that holds
            shares.
          </p>
        ) : null}
      </div>
    </section>
  );
}
