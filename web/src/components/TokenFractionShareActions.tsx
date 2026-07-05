import { useCallback, useEffect, useRef, useState } from 'react';
import { txUrl } from '../chain';
import {
  cancelBuyerRewardPool,
  fetchBuyerRewardPoolState,
  fundBuyerRewardPool,
  listFractionShares,
  parseAirdropRecipients,
  parseEthPriceWei,
  parseFractionRecipient,
  parseFractionShareAmount,
  redeemFractionShares,
  transferFractionShares,
  airdropFractionShares,
  type TokenFractionInfo,
} from '../lib/tokenFractions';
import { processBuyerRewards, claimTradingFeesPublic } from '../api';
import { formatTokenBalance } from '../lib/formatTokenBalance';
import { zeroAddress } from 'viem';

type WalletLike = {
  address: string;
  getEthereumProvider: () => Promise<unknown>;
};

export function TokenFractionShareActions({
  info,
  wallet,
  walletShares,
  deployBlockNumber,
  shareTokenHuman,
  isFeeRecipient,
  onRefresh,
}: {
  info: TokenFractionInfo;
  wallet: WalletLike;
  walletShares: number;
  deployBlockNumber?: string | null;
  shareTokenHuman: string;
  isFeeRecipient: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('1');
  const [transferring, setTransferring] = useState(false);
  const [transferTx, setTransferTx] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  const [listAmount, setListAmount] = useState('1');
  const [listPriceEth, setListPriceEth] = useState('');
  const [listing, setListing] = useState(false);
  const [listTx, setListTx] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [airdropText, setAirdropText] = useState('');
  const [airdropDefaultAmount, setAirdropDefaultAmount] = useState('1');
  const [airdropping, setAirdropping] = useState(false);
  const [airdropProgress, setAirdropProgress] = useState<string | null>(null);
  const [airdropTx, setAirdropTx] = useState<string | null>(null);
  const [airdropError, setAirdropError] = useState<string | null>(null);

  const [fundRewardAmount, setFundRewardAmount] = useState('10');
  const [buyRewarding, setBuyRewarding] = useState(false);
  const [fundingRewards, setFundingRewards] = useState(false);
  const [cancellingRewards, setCancellingRewards] = useState(false);
  const [buyRewardMsg, setBuyRewardMsg] = useState<string | null>(null);
  const [buyRewardError, setBuyRewardError] = useState<string | null>(null);
  const [escrowRemaining, setEscrowRemaining] = useState<number | null>(null);
  const [escrowCap, setEscrowCap] = useState(0);
  const buyRewardInFlight = useRef(false);

  const [redeemAmount, setRedeemAmount] = useState('1');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemTx, setRedeemTx] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const [claimingFees, setClaimingFees] = useState(false);
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [pendingFees, setPendingFees] = useState<{ pending0: bigint; pending1: bigint } | null>(
    null,
  );

  useEffect(() => {
    void fetchBuyerRewardPoolState(info.collectionAddress).then((s) => {
      setEscrowCap(s.cap);
      setEscrowRemaining(s.remaining);
    });
  }, [info.collectionAddress, walletShares]);

  const rewardNewBuyers = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (buyRewardInFlight.current) return;
      if (escrowCap <= 0 || (escrowRemaining ?? 0) <= 0) {
        if (!opts?.silent) {
          setBuyRewardMsg('Fund a buyer-reward pool first to enable automatic rewards.');
        }
        return;
      }
      buyRewardInFlight.current = true;
      const showUi = !opts?.silent;
      if (showUi) {
        setBuyRewardError(null);
        setBuyRewardMsg(null);
        setBuyRewarding(true);
      }
      try {
        const result = await processBuyerRewards(info.launchToken);
        if (result.issued > 0 || showUi) {
          setBuyRewardMsg(result.message);
        }
        setEscrowRemaining(result.status.remaining);
        if (result.issued > 0) await onRefresh();
      } catch (e) {
        if (showUi) {
          setBuyRewardError(e instanceof Error ? e.message : 'Reward failed');
        }
      } finally {
        setBuyRewarding(false);
        buyRewardInFlight.current = false;
      }
    },
    [escrowCap, escrowRemaining, info.launchToken, onRefresh],
  );

  useEffect(() => {
    if (escrowCap <= 0 || (escrowRemaining ?? 0) <= 0) return;

    const tick = () => {
      void rewardNewBuyers({ silent: true });
    };
    tick();
    const id = window.setInterval(tick, 45_000);
    return () => window.clearInterval(id);
  }, [escrowCap, escrowRemaining, rewardNewBuyers]);

  async function refreshEscrowState() {
    const s = await fetchBuyerRewardPoolState(info.collectionAddress);
    setEscrowCap(s.cap);
    setEscrowRemaining(s.remaining);
  }

  useEffect(() => {
    void import('../lib/tokenFractions').then(({ fetchPendingFractionTradingFees }) =>
      fetchPendingFractionTradingFees(info.collectionAddress, wallet.address as `0x${string}`).then(
        setPendingFees,
      ),
    );
  }, [info.collectionAddress, wallet.address, walletShares]);

  async function runTransfer(
    recipientRaw: string,
    amountRaw: string,
    setErr: (s: string | null) => void,
    setTx: (s: string | null) => void,
    setBusy: (b: boolean) => void,
    onDone?: () => void,
  ) {
    setErr(null);
    setTx(null);
    const recipient = parseFractionRecipient(recipientRaw);
    if (!recipient) {
      setErr('Enter a valid 0x wallet address.');
      return;
    }
    const amount = parseFractionShareAmount(amountRaw, walletShares);
    if (amount == null) {
      setErr(`Enter 1–${walletShares.toLocaleString()} shares.`);
      return;
    }
    setBusy(true);
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
      setTx(hash);
      onDone?.();
      await onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="token-fraction-actions">
      <div className="token-fraction-action">
        <p className="token-fraction-action-title">Send shares</p>
        <p className="muted token-fraction-action-hint">
          Transfer to one wallet. You hold {walletShares.toLocaleString()} share
          {walletShares === 1 ? '' : 's'} — full amount, no platform fee.
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
            void runTransfer(transferTo, transferAmount, setTransferError, setTransferTx, setTransferring, () => {
              setTransferTo('');
              setTransferAmount('1');
            });
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
        <p className="token-fraction-action-title">List shares for sale</p>
        <p className="muted token-fraction-action-hint">
          Escrow shares at your asking price. On sale: you receive 95% of the listed price; hood.markets
          collects 5% (one of two platform fees — the other is on swap trading fees).
        </p>
        <label className="token-fraction-field">
          Share count
          <input
            className="lp-input"
            value={listAmount}
            onChange={(e) => setListAmount(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="1"
            inputMode="numeric"
          />
        </label>
        <label className="token-fraction-field">
          Price (ETH)
          <input
            className="lp-input"
            value={listPriceEth}
            onChange={(e) => setListPriceEth(e.target.value)}
            placeholder="0.05"
            inputMode="decimal"
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={listing}
          onClick={() => {
            void (async () => {
              setListError(null);
              setListTx(null);
              const amount = parseFractionShareAmount(listAmount, walletShares);
              if (amount == null) {
                setListError(`Enter 1–${walletShares.toLocaleString()} shares.`);
                return;
              }
              const priceWei = parseEthPriceWei(listPriceEth);
              if (priceWei == null) {
                setListError('Enter a valid ETH price (e.g. 0.05).');
                return;
              }
              setListing(true);
              try {
                const provider = await wallet.getEthereumProvider();
                const hash = await listFractionShares(
                  info.collectionAddress,
                  wallet.address as `0x${string}`,
                  amount,
                  priceWei,
                  zeroAddress,
                  provider,
                );
                setListTx(hash);
                setListAmount('1');
                setListPriceEth('');
                await onRefresh();
              } catch (e) {
                setListError(e instanceof Error ? e.message : 'List failed');
              } finally {
                setListing(false);
              }
            })();
          }}
        >
          {listing ? 'Listing…' : 'List for sale'}
        </button>
        {listTx ? (
          <p className="mono token-fraction-action-tx">
            Listed ·{' '}
            <a href={txUrl(listTx)} target="_blank" rel="noreferrer">
              {listTx.slice(0, 10)}…
            </a>
          </p>
        ) : null}
        {listError ? <p className="error">{listError}</p> : null}
      </div>

      <div className="token-fraction-action">
        <p className="token-fraction-action-title">Airdrop to many</p>
        <p className="muted token-fraction-action-hint">
          One address per line. Optional <code>,count</code> per line — otherwise uses default count.
          Duplicate wallets are merged. One transaction when supported (v0.10+). Full amounts — no platform
          fee (only swap fees and marketplace sales are taxed).
        </p>
        <label className="token-fraction-field">
          Wallets
          <textarea
            className="lp-input token-fraction-textarea"
            value={airdropText}
            onChange={(e) => setAirdropText(e.target.value)}
            placeholder={'0xabc…\n0xdef…,2\n0x123…'}
            rows={4}
          />
        </label>
        <label className="token-fraction-field">
          Default shares per wallet
          <input
            className="lp-input"
            value={airdropDefaultAmount}
            onChange={(e) => setAirdropDefaultAmount(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="1"
            inputMode="numeric"
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={airdropping}
          onClick={() => {
            void (async () => {
              setAirdropError(null);
              setAirdropTx(null);
              setAirdropProgress(null);
              const defaultAmt = Number.parseInt(airdropDefaultAmount.trim() || '1', 10);
              const parsed = parseAirdropRecipients(airdropText, defaultAmt, walletShares);
              if ('error' in parsed) {
                setAirdropError(parsed.error);
                return;
              }
              setAirdropping(true);
              try {
                const provider = await wallet.getEthereumProvider();
                const result = await airdropFractionShares(
                  info.collectionAddress,
                  wallet.address as `0x${string}`,
                  parsed.entries,
                  info.tokenId,
                  provider,
                  (done, total) =>
                    setAirdropProgress(
                      done >= total ? 'Confirming…' : `${done}/${total} transfers (legacy)`,
                    ),
                );
                setAirdropTx(result.hash);
                setAirdropProgress(
                  result.batched
                    ? `Sent to ${result.count} wallet${result.count === 1 ? '' : 's'} in one transaction.`
                    : `Sent via ${result.count} transaction${result.count === 1 ? '' : 's'} (upgrade factory for one-tx airdrop).`,
                );
                setAirdropText('');
                await onRefresh();
              } catch (e) {
                setAirdropError(e instanceof Error ? e.message : 'Airdrop failed');
              } finally {
                setAirdropping(false);
              }
            })();
          }}
        >
          {airdropping ? 'Airdropping…' : 'Airdrop shares'}
        </button>
        {airdropProgress ? <p className="muted token-fraction-action-hint">{airdropProgress}</p> : null}
        {airdropTx ? (
          <p className="mono token-fraction-action-tx">
            Tx ·{' '}
            <a href={txUrl(airdropTx)} target="_blank" rel="noreferrer">
              {airdropTx.slice(0, 10)}…
            </a>
          </p>
        ) : null}
        {airdropError ? <p className="error">{airdropError}</p> : null}
      </div>

      <div className="token-fraction-action">
        <p className="token-fraction-action-title">Reward on buy</p>
        <p className="muted token-fraction-action-hint">
          Escrow shares for first unique pool buyers — hood.markets sends 1 share automatically when
          someone buys who does not hold one yet. You choose how many to escrow; cancel anytime to
          get unused shares back.
        </p>
        {(escrowRemaining ?? 0) > 0 ? (
          <p className="muted token-fraction-action-preview">
            <strong>{escrowRemaining ?? 0}</strong> of <strong>{escrowCap}</strong> shares in escrow
            {escrowCap > (escrowRemaining ?? 0)
              ? ` · ${escrowCap - (escrowRemaining ?? 0)} already rewarded`
              : ''}
          </p>
        ) : escrowCap > 0 ? (
          <p className="muted token-fraction-action-hint">Buyer reward escrow is exhausted.</p>
        ) : (
          <p className="muted token-fraction-action-hint">No buyer-reward escrow active yet.</p>
        )}
        {isFeeRecipient ? (
          <>
            <label className="token-fraction-field">
              Shares to escrow
              <input
                className="lp-input"
                value={fundRewardAmount}
                onChange={(e) => setFundRewardAmount(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="10"
                inputMode="numeric"
              />
            </label>
            <div className="token-fraction-action-row">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={fundingRewards || walletShares <= 0}
                onClick={() => {
                  void (async () => {
                    setBuyRewardError(null);
                    setBuyRewardMsg(null);
                    const amount = parseFractionShareAmount(fundRewardAmount, walletShares);
                    if (amount == null) {
                      setBuyRewardError(`Enter 1–${walletShares.toLocaleString()} shares.`);
                      return;
                    }
                    setFundingRewards(true);
                    try {
                      const provider = await wallet.getEthereumProvider();
                      await fundBuyerRewardPool(
                        info.collectionAddress,
                        wallet.address as `0x${string}`,
                        amount,
                        provider,
                      );
                      setBuyRewardMsg(`Escrowed ${amount} share(s) for buyer rewards.`);
                      setFundRewardAmount('10');
                      await refreshEscrowState();
                      await onRefresh();
                    } catch (e) {
                      setBuyRewardError(e instanceof Error ? e.message : 'Escrow failed');
                    } finally {
                      setFundingRewards(false);
                    }
                  })();
                }}
              >
                {fundingRewards ? 'Escrowing…' : 'Fund buyer rewards'}
              </button>
              {(escrowRemaining ?? 0) > 0 ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={buyRewarding}
                    onClick={() => {
                      void rewardNewBuyers();
                    }}
                  >
                    {buyRewarding ? 'Checking…' : 'Check now'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={cancellingRewards}
                    onClick={() => {
                      void (async () => {
                        setBuyRewardError(null);
                        setBuyRewardMsg(null);
                        setCancellingRewards(true);
                        try {
                          const provider = await wallet.getEthereumProvider();
                          await cancelBuyerRewardPool(
                            info.collectionAddress,
                            wallet.address as `0x${string}`,
                            provider,
                          );
                          setBuyRewardMsg(
                            'Cancelled buyer rewards — unused shares returned to your wallet.',
                          );
                          await refreshEscrowState();
                          await onRefresh();
                        } catch (e) {
                          setBuyRewardError(
                            e instanceof Error ? e.message : 'Cancel failed (needs latest factory)',
                          );
                        } finally {
                          setCancellingRewards(false);
                        }
                      })();
                    }}
                  >
                    {cancellingRewards ? 'Cancelling…' : 'Cancel & reclaim'}
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : (escrowRemaining ?? 0) > 0 ? (
          <p className="muted token-fraction-action-hint">
            Rewards run automatically while escrow remains. Only the launch fee recipient can fund or
            cancel the pool.
          </p>
        ) : null}
        {buyRewardMsg ? <p className="muted token-fraction-pending">{buyRewardMsg}</p> : null}
        {buyRewardError ? <p className="error">{buyRewardError}</p> : null}
      </div>

      <div className="token-fraction-action">
        <p className="token-fraction-action-title">Exit vault for launch tokens (optional)</p>
        <p className="muted token-fraction-action-hint">
          At launch, 10% of supply sits in a vault as 1,000 shares. You can permanently burn shares
          to withdraw {shareTokenHuman} launch tokens per share — a one-time cash-out from that
          vault.
        </p>
        <p className="muted token-fraction-action-hint">
          <strong>You lose those shares</strong> and stop earning trading fees on them. Fees keep
          going to whoever still holds shares — if everyone exits, no shares remain and the fee
          split ends (pool fees may still accrue until claimed).
        </p>
        <label className="token-fraction-field">
          Share count to burn
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
              Vault sends ~{formatTokenBalance(underlying, 18)} launch tokens to your wallet.
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
                setRedeemAmount('1');
                await onRefresh();
              } catch (e) {
                setRedeemError(e instanceof Error ? e.message : 'Exit failed');
              } finally {
                setRedeeming(false);
              }
            })();
          }}
        >
          {redeeming ? 'Exiting…' : 'Burn shares for tokens'}
        </button>
        {redeemTx ? (
          <p className="mono token-fraction-action-tx">
            Exited vault ·{' '}
            <a href={txUrl(redeemTx)} target="_blank" rel="noreferrer">
              {redeemTx.slice(0, 10)}…
            </a>
          </p>
        ) : null}
        {redeemError ? <p className="error">{redeemError}</p> : null}
      </div>

      <div className="token-fraction-action">
        <p className="token-fraction-action-title">Trading fees</p>
        <p className="muted token-fraction-action-hint">
          Pulls Uniswap swap fees from the locked LP. Locker split: <strong>5% platform / 95% to holders</strong>{' '}
          (pro-rata) — then one tx pays every share holder. This is one of the two platform fees; the other
          is 5% on share marketplace sales.
        </p>
        {pendingFees && (pendingFees.pending0 > 0n || pendingFees.pending1 > 0n) ? (
          <p className="muted token-fraction-pending">
            Your share when claimed:{' '}
            {pendingFees.pending0 > 0n ? `${formatTokenBalance(pendingFees.pending0, 18)} WETH` : null}
            {pendingFees.pending0 > 0n && pendingFees.pending1 > 0n ? ' · ' : null}
            {pendingFees.pending1 > 0n ? `${formatTokenBalance(pendingFees.pending1, 18)} token` : null}
          </p>
        ) : (
          <p className="muted token-fraction-pending">No unclaimed fees for your shares yet.</p>
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
                const out = await claimTradingFeesPublic(info.launchToken);
                if (!out.ok && out.error) throw new Error(out.error);
                if (out.txHash) setClaimTx(out.txHash);
                const { fetchPendingFractionTradingFees } = await import('../lib/tokenFractions');
                const pending = await fetchPendingFractionTradingFees(
                  info.collectionAddress,
                  wallet.address as `0x${string}`,
                );
                setPendingFees(pending);
                await onRefresh();
              } catch (e) {
                setClaimError(e instanceof Error ? e.message : 'Claim failed');
              } finally {
                setClaimingFees(false);
              }
            })();
          }}
        >
          {claimingFees ? 'Claiming…' : 'Claim trading fees'}
        </button>
        {claimTx ? (
          <p className="mono token-fraction-action-tx">
            Claimed for all holders ·{' '}
            <a href={txUrl(claimTx)} target="_blank" rel="noreferrer">
              {claimTx.slice(0, 10)}…
            </a>
          </p>
        ) : null}
        {claimError ? <p className="error">{claimError}</p> : null}
      </div>
    </div>
  );
}
