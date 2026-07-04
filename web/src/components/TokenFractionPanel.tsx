import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { addressUrl, shortenAddress, tokenUrl, txUrl } from '../chain';
import { openWalletProfile } from '../lib/deployerProfileRoute';
import { formatTokenBalance } from '../lib/formatTokenBalance';
import { isSimpleLaunchDeployment } from '../lib/launchType';
import {
  claimFractionTradingFees,
  fetchPendingFractionTradingFees,
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
  const { authenticated } = usePrivy();
  const wallet = wallets[0];
  const walletAddress = wallet?.address;
  const [info, setInfo] = useState<TokenFractionInfo | null>(null);
  const [walletShares, setWalletShares] = useState<number | null>(null);
  const [pendingFees, setPendingFees] = useState<{ pending0: bigint; pending1: bigint } | null>(
    null,
  );
  const [claimingFees, setClaimingFees] = useState(false);
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
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
      setPendingFees(null);
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
    void fetchPendingFractionTradingFees(
      info.collectionAddress,
      walletAddress as `0x${string}`,
    )
      .then((row) => {
        if (!cancelled) setPendingFees(row);
      })
      .catch(() => {
        if (!cancelled) setPendingFees(null);
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

      {(isFeeRecipientWallet || (walletShares != null && walletShares > 0)) ? (
        <div className="token-fraction-manage">
          <p className="token-fraction-manage-title">
            {isFeeRecipientWallet ? 'You received the launch shares' : 'You hold shares'}
          </p>
          <ul className="token-fraction-manage-list">
            <li>Claim your pro-rata trading fees below (pulls from pool if needed)</li>
            <li>Sell or list on NFT marketplaces (ERC-1155 transfer)</li>
            <li>Gift or airdrop shares to any wallet</li>
            <li>Reward early buyers — send shares to their wallets after they trade</li>
            <li>Redeem on-chain via the collection contract to receive underlying tokens</li>
          </ul>
          {authenticated && wallet && walletShares != null && walletShares > 0 ? (
            <div className="token-fraction-claim">
              {pendingFees && (pendingFees.pending0 > 0n || pendingFees.pending1 > 0n) ? (
                <p className="muted token-fraction-pending">
                  Pending fees:{' '}
                  {pendingFees.pending0 > 0n
                    ? `${formatTokenBalance(pendingFees.pending0, 18)} WETH`
                    : null}
                  {pendingFees.pending0 > 0n && pendingFees.pending1 > 0n ? ' · ' : null}
                  {pendingFees.pending1 > 0n
                    ? `${formatTokenBalance(pendingFees.pending1, 18)} token`
                    : null}
                </p>
              ) : (
                <p className="muted token-fraction-pending">No unclaimed fees yet for your shares.</p>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={claimingFees}
                onClick={() => {
                  void (async () => {
                    setClaimError(null);
                    setClaimTx(null);
                    setClaimingFees(true);
                    try {
                      const provider = await wallet.getEthereumProvider();
                      const hash = await claimFractionTradingFees(
                        info.collectionAddress,
                        wallet.address as `0x${string}`,
                        provider,
                      );
                      setClaimTx(hash);
                      const pending = await fetchPendingFractionTradingFees(
                        info.collectionAddress,
                        wallet.address as `0x${string}`,
                      );
                      setPendingFees(pending);
                    } catch (e) {
                      setClaimError(e instanceof Error ? e.message : 'Claim failed');
                    } finally {
                      setClaimingFees(false);
                    }
                  })();
                }}
              >
                {claimingFees ? 'Claiming…' : 'Claim my trading fees'}
              </button>
              {claimTx ? (
                <p className="mono token-fraction-claim-tx">
                  <a href={txUrl(claimTx)} target="_blank" rel="noreferrer">
                    {claimTx.slice(0, 10)}…
                  </a>
                </p>
              ) : null}
              {claimError ? <p className="error">{claimError}</p> : null}
            </div>
          ) : null}
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
        Shares are ERC-1155 tokens — transferable like NFTs. All 1,000 mint to the fee recipient at
        launch. Holders call <code>claimTradingFees()</code> for their pro-rata slice of swap fees
        (95% creator pool) and <code>redeem(amount)</code> to burn shares for vaulted tokens.
      </p>
    </section>
  );
}
