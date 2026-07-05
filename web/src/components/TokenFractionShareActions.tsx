import { useEffect, useState } from 'react';
import { txUrl } from '../chain';
import {
  fetchBuyerRewardPoolState,
  fetchUniquePoolBuyerCandidates,
  parseAirdropRecipients,
  parseFractionRecipient,
  parseFractionShareAmount,
  redeemFractionShares,
  transferFractionShares,
  transferFractionSharesToMany,
  type TokenFractionInfo,
} from '../lib/tokenFractions';
import { processBuyerRewards } from '../api';
import { formatTokenBalance } from '../lib/formatTokenBalance';

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

  const [sellTo, setSellTo] = useState('');
  const [sellAmount, setSellAmount] = useState('1');
  const [sellNote, setSellNote] = useState('');
  const [selling, setSelling] = useState(false);
  const [sellTx, setSellTx] = useState<string | null>(null);
  const [sellError, setSellError] = useState<string | null>(null);

  const [airdropText, setAirdropText] = useState('');
  const [airdropDefaultAmount, setAirdropDefaultAmount] = useState('1');
  const [airdropping, setAirdropping] = useState(false);
  const [airdropProgress, setAirdropProgress] = useState<string | null>(null);
  const [airdropTx, setAirdropTx] = useState<string | null>(null);
  const [airdropError, setAirdropError] = useState<string | null>(null);

  const [buyRewardMax, setBuyRewardMax] = useState('50');
  const [buyCandidates, setBuyCandidates] = useState<string[]>([]);
  const [buyScanning, setBuyScanning] = useState(false);
  const [buyRewarding, setBuyRewarding] = useState(false);
  const [buyRewardMsg, setBuyRewardMsg] = useState<string | null>(null);
  const [buyRewardError, setBuyRewardError] = useState<string | null>(null);
  const [escrowRemaining, setEscrowRemaining] = useState<number | null>(null);
  const [escrowCap, setEscrowCap] = useState(0);

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
          {walletShares === 1 ? '' : 's'}.
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
        <p className="token-fraction-action-title">Sell shares (OTC)</p>
        <p className="muted token-fraction-action-hint">
          Transfer to the buyer after payment (off-chain or P2P). On-chain = ERC-1155 transfer only.
        </p>
        <label className="token-fraction-field">
          Buyer wallet
          <input
            className="lp-input"
            value={sellTo}
            onChange={(e) => setSellTo(e.target.value.trim())}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label className="token-fraction-field">
          Share count
          <input
            className="lp-input"
            value={sellAmount}
            onChange={(e) => setSellAmount(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="1"
            inputMode="numeric"
          />
        </label>
        <label className="token-fraction-field">
          Price note (optional, off-chain)
          <input
            className="lp-input"
            value={sellNote}
            onChange={(e) => setSellNote(e.target.value)}
            placeholder="e.g. 0.05 ETH — for your records"
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={selling}
          onClick={() => {
            void runTransfer(sellTo, sellAmount, setSellError, setSellTx, setSelling, () => {
              setSellTo('');
              setSellAmount('1');
              setSellNote('');
            });
          }}
        >
          {selling ? 'Transferring…' : 'Transfer to buyer'}
        </button>
        {sellTx ? (
          <p className="mono token-fraction-action-tx">
            Sold ·{' '}
            <a href={txUrl(sellTx)} target="_blank" rel="noreferrer">
              {sellTx.slice(0, 10)}…
            </a>
          </p>
        ) : null}
        {sellError ? <p className="error">{sellError}</p> : null}
      </div>

      <div className="token-fraction-action">
        <p className="token-fraction-action-title">Airdrop to many</p>
        <p className="muted token-fraction-action-hint">
          One address per line. Optional <code>,count</code> per line — otherwise uses default count.
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
        <p className="muted token-fraction-action-hint">
          {escrowCap > 0
            ? `Launch escrow: ${escrowRemaining ?? 0} of ${escrowCap} shares left for first unique buyers (gasless).`
            : 'Send 1 share from your wallet to each new unique pool buyer who does not hold a share yet.'}
        </p>
        <label className="token-fraction-field">
          Max buyers this run
          <input
            className="lp-input"
            value={buyRewardMax}
            onChange={(e) => setBuyRewardMax(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="50"
            inputMode="numeric"
          />
        </label>
        {buyCandidates.length > 0 ? (
          <p className="muted token-fraction-action-preview">
            {buyCandidates.length} wallet{buyCandidates.length === 1 ? '' : 's'} ready · 1 share each
          </p>
        ) : null}
        <div className="token-fraction-action-row">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={buyScanning}
            onClick={() => {
              void (async () => {
                setBuyRewardError(null);
                setBuyScanning(true);
                try {
                  const max = Number.parseInt(buyRewardMax.trim() || '50', 10);
                  const fromBlock = deployBlockNumber ? BigInt(deployBlockNumber) : undefined;
                  const candidates = await fetchUniquePoolBuyerCandidates({
                    collectionAddress: info.collectionAddress,
                    launchToken: info.launchToken,
                    fromBlock,
                    maxBuyers: Number.isFinite(max) && max > 0 ? max : 50,
                    excludeAddresses: [wallet.address as `0x${string}`],
                  });
                  setBuyCandidates(candidates);
                  setBuyRewardMsg(
                    candidates.length > 0
                      ? `Found ${candidates.length} new buyer${candidates.length === 1 ? '' : 's'}.`
                      : 'No new qualifying buyers yet.',
                  );
                } catch (e) {
                  setBuyRewardError(e instanceof Error ? e.message : 'Scan failed');
                } finally {
                  setBuyScanning(false);
                }
              })();
            }}
          >
            {buyScanning ? 'Scanning…' : 'Scan buys'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={
              buyRewarding ||
              (escrowCap > 0 ? (escrowRemaining ?? 0) <= 0 : buyCandidates.length === 0)
            }
            onClick={() => {
              void (async () => {
                setBuyRewardError(null);
                setBuyRewardMsg(null);
                setBuyRewarding(true);
                try {
                  if (escrowCap > 0 && (escrowRemaining ?? 0) > 0) {
                    const result = await processBuyerRewards(info.launchToken);
                    setBuyRewardMsg(result.message);
                    setBuyCandidates([]);
                    setEscrowRemaining(result.status.remaining);
                    await onRefresh();
                    return;
                  }
                  if (buyCandidates.length === 0) {
                    setBuyRewardError('Scan for new buyers first.');
                    return;
                  }
                  const totalShares = buyCandidates.reduce((n) => n + 1, 0);
                  if (totalShares > walletShares) {
                    setBuyRewardError(`Need ${totalShares} shares; you hold ${walletShares}.`);
                    return;
                  }
                  const provider = await wallet.getEthereumProvider();
                  const entries = buyCandidates.map((a) => ({
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
                  setBuyRewardMsg(`Sent 1 share to ${buyCandidates.length} buyer(s).`);
                  setBuyCandidates([]);
                  await onRefresh();
                } catch (e) {
                  setBuyRewardError(e instanceof Error ? e.message : 'Reward failed');
                } finally {
                  setBuyRewarding(false);
                }
              })();
            }}
          >
            {buyRewarding ? 'Sending…' : 'Reward buyers'}
          </button>
        </div>
        {buyRewardMsg ? <p className="muted token-fraction-pending">{buyRewardMsg}</p> : null}
        {buyRewardError ? <p className="error">{buyRewardError}</p> : null}
      </div>

      <div className="token-fraction-action">
        <p className="token-fraction-action-title">Redeem for tokens</p>
        <p className="muted token-fraction-action-hint">
          Burn shares for vaulted tokens ({shareTokenHuman} per share).
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
                setRedeemAmount('1');
                await onRefresh();
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
        <p className="muted token-fraction-action-hint">Pro-rata slice of the 95% creator fee pool.</p>
        {pendingFees && (pendingFees.pending0 > 0n || pendingFees.pending1 > 0n) ? (
          <p className="muted token-fraction-pending">
            Pending:{' '}
            {pendingFees.pending0 > 0n ? `${formatTokenBalance(pendingFees.pending0, 18)} WETH` : null}
            {pendingFees.pending0 > 0n && pendingFees.pending1 > 0n ? ' · ' : null}
            {pendingFees.pending1 > 0n ? `${formatTokenBalance(pendingFees.pending1, 18)} token` : null}
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
                const { claimFractionTradingFees, fetchPendingFractionTradingFees } =
                  await import('../lib/tokenFractions');
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
    </div>
  );
}
