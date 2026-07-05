import { useCallback, useEffect, useRef, useState } from 'react';
import { txUrl } from '../chain';
import {
  fetchBuyerRewardPoolState,
  fetchUniquePoolBuyerCandidates,
  listFractionShares,
  parseAirdropRecipients,
  parseEthPriceWei,
  parseFractionRecipient,
  parseFractionShareAmount,
  redeemFractionShares,
  transferFractionShares,
  transferFractionSharesToMany,
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
  onRefresh,
}: {
  info: TokenFractionInfo;
  wallet: WalletLike;
  walletShares: number;
  deployBlockNumber?: string | null;
  shareTokenHuman: string;
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

  const [buyRewardMax, setBuyRewardMax] = useState('10');
  const [buyRewarding, setBuyRewarding] = useState(false);
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
      buyRewardInFlight.current = true;
      const showUi = !opts?.silent;
      if (showUi) {
        setBuyRewardError(null);
        setBuyRewardMsg(null);
        setBuyRewarding(true);
      }
      try {
        if (escrowCap > 0 && (escrowRemaining ?? 0) > 0) {
          const result = await processBuyerRewards(info.launchToken);
          if (result.issued > 0 || showUi) {
            setBuyRewardMsg(result.message);
          }
          setEscrowRemaining(result.status.remaining);
          if (result.issued > 0) await onRefresh();
          return;
        }

        const max = Number.parseInt(buyRewardMax.trim() || '10', 10);
        const fromBlock = deployBlockNumber ? BigInt(deployBlockNumber) : undefined;
        const candidates = await fetchUniquePoolBuyerCandidates({
          collectionAddress: info.collectionAddress,
          launchToken: info.launchToken,
          fromBlock,
          maxBuyers: Number.isFinite(max) && max > 0 ? max : 10,
          excludeAddresses: [wallet.address as `0x${string}`],
        });

        if (candidates.length === 0) {
          if (showUi) setBuyRewardMsg('No new qualifying buyers yet.');
          return;
        }

        const totalShares = candidates.length;
        if (totalShares > walletShares) {
          if (showUi) {
            setBuyRewardError(`Need ${totalShares} shares; you hold ${walletShares}.`);
          }
          return;
        }

        if (!showUi) {
          setBuyRewardMsg(`Rewarding ${candidates.length} new buyer(s)…`);
        }
        setBuyRewarding(true);

        const provider = await wallet.getEthereumProvider();
        const entries = candidates.map((a) => ({
          address: a as `0x${string}`,
          amount: 1,
        }));
        await transferFractionSharesToMany(
          info.collectionAddress,
          wallet.address as `0x${string}`,
          entries,
          info.tokenId,
          provider,
          (done, total) => setBuyRewardMsg(`Rewarding ${done}/${total}…`),
        );
        setBuyRewardMsg(`Sent 1 share to ${candidates.length} buyer(s).`);
        await onRefresh();
      } catch (e) {
        if (showUi) {
          setBuyRewardError(e instanceof Error ? e.message : 'Reward failed');
        }
      } finally {
        setBuyRewarding(false);
        buyRewardInFlight.current = false;
      }
    },
    [
      buyRewardMax,
      deployBlockNumber,
      escrowCap,
      escrowRemaining,
      info.collectionAddress,
      info.launchToken,
      info.tokenId,
      onRefresh,
      wallet,
      walletShares,
    ],
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
          {walletShares === 1 ? '' : 's'}. A 5% platform fee is skimmed from each send (recipient gets
          95%; tiny amounts may round to zero).
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
          Escrow shares in the contract at your asking price. Buyers pay the listed price in ETH; you receive
          95% and hood.markets collects 5% to the platform fee wallet (same as swap fees).
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
          One address per line. Optional <code>,count</code> per line — otherwise uses default count. Each
          line is a wallet send with the same 5% platform skim (95% delivered).
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
                const result = await transferFractionSharesToMany(
                  info.collectionAddress,
                  wallet.address as `0x${string}`,
                  parsed.entries,
                  info.tokenId,
                  provider,
                  (done, total) => setAirdropProgress(`${done}/${total} transfers`),
                );
                setAirdropTx(result.lastHash);
                setAirdropText('');
                await onRefresh();
              } catch (e) {
                setAirdropError(e instanceof Error ? e.message : 'Airdrop failed');
              } finally {
                setAirdropping(false);
                setAirdropProgress(null);
              }
            })();
          }}
        >
          {airdropping ? 'Airdropping…' : 'Airdrop shares'}
        </button>
        {airdropProgress ? <p className="muted token-fraction-action-hint">{airdropProgress}</p> : null}
        {airdropTx ? (
          <p className="mono token-fraction-action-tx">
            Last tx ·{' '}
            <a href={txUrl(airdropTx)} target="_blank" rel="noreferrer">
              {airdropTx.slice(0, 10)}…
            </a>
          </p>
        ) : null}
        {airdropError ? <p className="error">{airdropError}</p> : null}
      </div>

      <div className="token-fraction-action">
        <p className="token-fraction-action-title">Reward on buy</p>
        {escrowCap > 0 ? (
          <>
            <p className="muted token-fraction-action-hint">
              <strong>{escrowRemaining ?? 0}</strong> of <strong>{escrowCap}</strong> shares escrowed
              at launch for first unique pool buyers. When someone buys who does not hold a share yet,
              hood.markets automatically sends them 1 share from escrow — no wallet approval needed.
            </p>
            {(escrowRemaining ?? 0) > 0 ? (
              <p className="muted token-fraction-action-hint">
                Checks run in the background on the API and while this page is open.
              </p>
            ) : (
              <p className="muted token-fraction-action-hint">Buyer reward escrow is exhausted.</p>
            )}
            {(escrowRemaining ?? 0) > 0 ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={buyRewarding}
                onClick={() => {
                  void rewardNewBuyers();
                }}
              >
                {buyRewarding ? 'Checking…' : 'Check for new buyers now'}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className="muted token-fraction-action-hint">
              This token has no buyer-reward escrow (launched before escrow was enabled). Send shares
              manually from your wallet, or launch a new token on the latest factory for automatic
              escrow rewards.
            </p>
            <label className="token-fraction-field">
              Max buyers per send
              <input
                className="lp-input"
                value={buyRewardMax}
                onChange={(e) => setBuyRewardMax(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="10"
                inputMode="numeric"
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={buyRewarding || walletShares <= 0}
              onClick={() => {
                void rewardNewBuyers();
              }}
            >
              {buyRewarding ? 'Sending…' : 'Send shares to new buyers'}
            </button>
          </>
        )}
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
          Anyone can claim in one transaction — pool fees are pulled and sent pro-rata to every share
          holder.
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
