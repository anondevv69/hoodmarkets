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
  parseFractionRecipient,
  parseFractionShareAmount,
  redeemFractionShares,
  transferFractionShares,
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
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferTx, setTransferTx] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemTx, setRedeemTx] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
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

  async function refreshFractionState(collectionAddress: `0x${string}`) {
    const fromBlock = deployBlockNumber ? BigInt(deployBlockNumber) : undefined;
    const [row, shares, pending] = await Promise.all([
      fetchTokenFractionInfo(tokenAddress, { fromBlock, factoryAddress }),
      walletAddress
        ? fetchWalletFractionBalance(
            collectionAddress,
            walletAddress as `0x${string}`,
            info?.tokenId ?? 0,
          )
        : Promise.resolve(null),
      walletAddress
        ? fetchPendingFractionTradingFees(collectionAddress, walletAddress as `0x${string}`)
        : Promise.resolve(null),
    ]);
    setInfo(row);
    if (shares != null) setWalletShares(shares);
    if (pending) setPendingFees(pending);
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

      <div className="token-fraction-layout">
        {(isFeeRecipientWallet || (walletShares != null && walletShares > 0)) ? (
          <div className="token-fraction-manage token-fraction-layout-manage">
            <p className="token-fraction-manage-title">
              {isFeeRecipientWallet ? 'You received the launch shares' : 'You hold shares'}
            </p>
            {!authenticated || !wallet ? (
              <p className="muted token-fraction-note">
                Connect your wallet to send shares, redeem vault tokens, or claim fees.
              </p>
            ) : walletShares != null && walletShares > 0 ? (
              <div className="token-fraction-actions">
              <div className="token-fraction-action">
                <p className="token-fraction-action-title">Send shares</p>
                <p className="muted token-fraction-action-hint">
                  Airdrop or transfer to any wallet (ERC-1155). You have{' '}
                  {walletShares.toLocaleString()} share{walletShares === 1 ? '' : 's'}.
                </p>
                <label className="token-fraction-field">
                  Recipient wallet
                  <input
                    className="lp-input"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value.trim())}
                    placeholder="0x…"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </label>
                <label className="token-fraction-field">
                  Share count
                  <input
                    className="lp-input"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="1"
                    inputMode="numeric"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={transferring}
                  onClick={() => {
                    void (async () => {
                      setTransferError(null);
                      setTransferTx(null);
                      const recipient = parseFractionRecipient(transferTo);
                      if (!recipient) {
                        setTransferError('Enter a valid 0x wallet address.');
                        return;
                      }
                      const amount = parseFractionShareAmount(transferAmount, walletShares);
                      if (amount == null) {
                        setTransferError(`Enter 1–${walletShares.toLocaleString()} shares.`);
                        return;
                      }
                      setTransferring(true);
                      try {
                        const provider = await wallet.getEthereumProvider();
                        const hash = await transferFractionShares(
                          info.collectionAddress,
                          wallet.address as `0x${string}`,
                          recipient,
                          amount,
                          info.tokenId,
                          provider,
                        );
                        setTransferTx(hash);
                        setTransferTo('');
                        setTransferAmount('');
                        await refreshFractionState(info.collectionAddress);
                      } catch (e) {
                        setTransferError(e instanceof Error ? e.message : 'Transfer failed');
                      } finally {
                        setTransferring(false);
                      }
                    })();
                  }}
                >
                  {transferring ? 'Sending…' : 'Send shares'}
                </button>
                {transferTx ? (
                  <p className="mono token-fraction-action-tx">
                    Sent ·{' '}
                    <a href={txUrl(transferTx)} target="_blank" rel="noreferrer">
                      {transferTx.slice(0, 10)}…
                    </a>
                  </p>
                ) : null}
                {transferError ? <p className="error">{transferError}</p> : null}
              </div>

              <div className="token-fraction-action">
                <p className="token-fraction-action-title">Redeem for tokens</p>
                <p className="muted token-fraction-action-hint">
                  Burn shares to receive vaulted launch tokens ({shareTokenHuman} per share).
                </p>
                <label className="token-fraction-field">
                  Share count
                  <input
                    className="lp-input"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="1"
                    inputMode="numeric"
                  />
                </label>
                {(() => {
                  const parsed = parseFractionShareAmount(redeemAmount, walletShares);
                  if (parsed == null) return null;
                  const underlying = BigInt(parsed) * info.tokensPerShare;
                  return (
                    <p className="muted token-fraction-action-preview">
                      You receive ~{formatTokenBalance(underlying, 18)} launch tokens.
                    </p>
                  );
                })()}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={redeeming}
                  onClick={() => {
                    void (async () => {
                      setRedeemError(null);
                      setRedeemTx(null);
                      const amount = parseFractionShareAmount(redeemAmount, walletShares);
                      if (amount == null) {
                        setRedeemError(`Enter 1–${walletShares.toLocaleString()} shares.`);
                        return;
                      }
                      setRedeeming(true);
                      try {
                        const provider = await wallet.getEthereumProvider();
                        const hash = await redeemFractionShares(
                          info.collectionAddress,
                          wallet.address as `0x${string}`,
                          amount,
                          provider,
                        );
                        setRedeemTx(hash);
                        setRedeemAmount('');
                        await refreshFractionState(info.collectionAddress);
                      } catch (e) {
                        setRedeemError(e instanceof Error ? e.message : 'Redeem failed');
                      } finally {
                        setRedeeming(false);
                      }
                    })();
                  }}
                >
                  {redeeming ? 'Redeeming…' : 'Redeem shares'}
                </button>
                {redeemTx ? (
                  <p className="mono token-fraction-action-tx">
                    Redeemed ·{' '}
                    <a href={txUrl(redeemTx)} target="_blank" rel="noreferrer">
                      {redeemTx.slice(0, 10)}…
                    </a>
                  </p>
                ) : null}
                {redeemError ? <p className="error">{redeemError}</p> : null}
              </div>

              <div className="token-fraction-action">
                <p className="token-fraction-action-title">Claim trading fees</p>
                <p className="muted token-fraction-action-hint">
                  Pull your pro-rata slice of the 95% creator fee pool (WETH + token).
                </p>
                {pendingFees && (pendingFees.pending0 > 0n || pendingFees.pending1 > 0n) ? (
                  <p className="muted token-fraction-pending">
                    Pending:{' '}
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
                  <p className="mono token-fraction-action-tx">
                    Claimed ·{' '}
                    <a href={txUrl(claimTx)} target="_blank" rel="noreferrer">
                      {claimTx.slice(0, 10)}…
                    </a>
                  </p>
                ) : null}
                {claimError ? <p className="error">{claimError}</p> : null}
              </div>

              <p className="muted token-fraction-action-foot">
                To sell or list shares, transfer them to a marketplace wallet or use{' '}
                <a href={tokenUrl(info.collectionAddress)} target="_blank" rel="noreferrer">
                  Blockscout
                </a>{' '}
                with your wallet.
              </p>
            </div>
          ) : (
            <p className="muted token-fraction-note">Your connected wallet does not hold any shares.</p>
          )}
          </div>
        ) : (
          <div className="token-fraction-manage token-fraction-layout-manage token-fraction-layout-manage--empty">
            <p className="muted token-fraction-note">
              Connect the fee recipient wallet or a share holder to send, redeem, or claim.
            </p>
          </div>
        )}

        <div className="token-fraction-layout-aside">
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

        <div className="token-fraction-layout-table">
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

        <p className="muted token-fraction-foot token-fraction-layout-foot">
          Shares are ERC-1155 tokens — transferable like NFTs. All 1,000 mint to the fee recipient at
          launch. Send any number to other wallets; those holders can airdrop, sell, or claim fees
          pro-rata. On-chain: <code>claimTradingFees()</code> for swap fees (95% creator pool) and{' '}
          <code>redeem(amount)</code> to burn shares for vaulted tokens.
        </p>
      </div>
    </section>
  );
}
