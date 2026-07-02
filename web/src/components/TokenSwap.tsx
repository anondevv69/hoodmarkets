import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { txUrl } from '../chain';
import { ensureRobinhoodChainInWallet } from '../lib/ensureRobinhoodChain';
import { fetchTokenSwapConfig, swapEthForHoodmarketsToken } from '../lib/robinhoodSwap';

const BUY_PRESETS = ['0.001', '0.005', '0.01', '0.02'] as const;

export function TokenSwap({
  tokenAddress,
  symbol,
  suggestedBuyEth,
}: {
  tokenAddress: string;
  symbol: string;
  suggestedBuyEth?: string;
}) {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [amountEth, setAmountEth] = useState(suggestedBuyEth?.trim() || '0.005');
  const [loading, setLoading] = useState(false);
  const [swapStep, setSwapStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (suggestedBuyEth?.trim()) setAmountEth(suggestedBuyEth.trim());
  }, [suggestedBuyEth]);

  useEffect(() => {
    let cancelled = false;
    void fetchTokenSwapConfig(tokenAddress)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenAddress]);

  if (!ready) return null;

  async function onBuy() {
    setError(null);
    setTxHash(null);
    setSuccessMsg(null);
    if (!authenticated || !wallet?.address) {
      login();
      return;
    }
    setLoading(true);
    setSwapStep(null);
    try {
      const provider = await wallet.getEthereumProvider();
      await ensureRobinhoodChainInWallet(
        provider as Parameters<typeof ensureRobinhoodChainInWallet>[0],
      );
      const config = await fetchTokenSwapConfig(tokenAddress);
      const result = await swapEthForHoodmarketsToken({
        config,
        amountEth,
        walletProvider: provider,
        account: wallet.address as `0x${string}`,
        onStep: (step, total, label) => {
          setSwapStep(`Step ${step}/${total}: ${label}`);
        },
      });
      setTxHash(result.swapTxHash);
      setSuccessMsg(
        `You received ${result.tokenBalance} $${sym} in your wallet.` +
          (result.stepsSkipped.length > 0
            ? ` (Skipped ${result.stepsSkipped.length} step(s) already done.)`
            : ''),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Swap failed');
    } finally {
      setLoading(false);
      setSwapStep(null);
    }
  }

  const sym = symbol.replace(/^\$/, '');

  return (
    <div className="lp-card token-swap-card">
      <p className="section-label">Buy on hood.markets</p>
      <p className="muted token-swap-note">
        Hoodmarkets pools use Uniswap v4 with a custom hook — MetaMask may ask for 2–4 quick
        confirmations (wrap → approve → swap). Steps you already finished are skipped automatically.
        <strong> Bundling your buy at launch</strong> (Launch tab) needs only one transaction.
      </p>

      <div className="initial-buy-presets" style={{ marginBottom: '0.75rem' }}>
        {BUY_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`btn btn-ghost btn-sm${amountEth === preset ? ' filter-chip--active' : ''}`}
            onClick={() => setAmountEth(preset)}
          >
            {preset} ETH
          </button>
        ))}
      </div>

      <label className="token-swap-field">
        <span className="muted">Amount (ETH)</span>
        <input
          className="lp-input"
          type="text"
          inputMode="decimal"
          value={amountEth}
          onChange={(e) => setAmountEth(e.target.value)}
          placeholder="0.005"
        />
      </label>

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: '0.75rem' }}
        disabled={loading}
        onClick={() => void onBuy()}
      >
        {loading
          ? (swapStep ?? 'Confirm in wallet…')
          : successMsg
            ? 'Buy again'
            : `Buy $${sym}`}
      </button>

      {error ? (
        <p className="error" style={{ marginTop: '0.75rem' }}>
          {error}
          {/base fee|max fee per gas/i.test(error) ? (
            <>
              {' '}
              Click <strong>Buy</strong> again — earlier wrap/approve steps are saved and only the
              remaining step(s) will run.
            </>
          ) : null}
        </p>
      ) : null}
      {successMsg ? (
        <p className="token-swap-success" style={{ marginTop: '0.75rem' }}>
          {successMsg}
        </p>
      ) : null}
      {txHash ? (
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Last tx —{' '}
          <a href={txUrl(txHash)} target="_blank" rel="noreferrer">
            view on explorer
          </a>
        </p>
      ) : null}
    </div>
  );
}
