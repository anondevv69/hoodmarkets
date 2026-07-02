import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { createPublicClient, custom, erc20Abi, formatEther } from 'viem';
import { robinhood, txUrl } from '../chain';
import { ensureRobinhoodChainInWallet } from '../lib/ensureRobinhoodChain';
import {
  fetchTokenSwapConfig,
  swapEthForHoodmarketsToken,
  swapHoodmarketsTokenForEth,
  type TokenSwapConfig,
} from '../lib/robinhoodSwap';

const BUY_PRESETS = ['0.001', '0.005', '0.01', '0.02'] as const;
const SELL_PRESETS = ['25', '50', '75', '100'] as const;

type SwapMode = 'buy' | 'sell';

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
  const [mode, setMode] = useState<SwapMode>('buy');
  const [amountEth, setAmountEth] = useState(suggestedBuyEth?.trim() || '0.005');
  const [amountTokens, setAmountTokens] = useState('1000');
  const [sellPct, setSellPct] = useState<number | null>(null);
  const [config, setConfig] = useState<TokenSwapConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapStep, setSwapStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (suggestedBuyEth?.trim()) setAmountEth(suggestedBuyEth.trim());
  }, [suggestedBuyEth]);

  useEffect(() => {
    let cancelled = false;
    void fetchTokenSwapConfig(tokenAddress)
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenAddress]);

  if (!config) return null;

  const sym = symbol.replace(/^\$/, '');
  const oneClick = Boolean(config.swapHelper);

  async function onSwap() {
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
      const swapConfig = await fetchTokenSwapConfig(tokenAddress);
      let sellAmount = amountTokens;

      if (mode === 'sell' && amountTokens.trim().endsWith('%')) {
        const pct = Number(amountTokens.trim().replace('%', ''));
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
          throw new Error('Enter a sell percentage between 1 and 100.');
        }
        const publicClient = createPublicClient({
          chain: robinhood,
          transport: custom(provider as Parameters<typeof custom>[0]),
        });
        const bal = await publicClient.readContract({
          address: swapConfig.tokenAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [wallet.address as `0x${string}`],
        });
        if (bal <= 0n) throw new Error('You have no tokens to sell.');
        const slice = (bal * BigInt(Math.round(pct * 100))) / 10000n;
        if (slice <= 0n) throw new Error('Sell amount too small.');
        sellAmount = formatEther(slice);
      }

      if (mode === 'buy') {
        const result = await swapEthForHoodmarketsToken({
          config: swapConfig,
          amountEth,
          walletProvider: provider,
          account: wallet.address as `0x${string}`,
          onStep: (step, total, label) => {
            setSwapStep(`Step ${step}/${total}: ${label}`);
          },
        });
        setTxHash(result.swapTxHash);
        setSuccessMsg(
          `You received ${result.amountOut} $${sym}.` +
            (result.stepsSkipped.length > 0
              ? ` (Skipped ${result.stepsSkipped.length} step(s) already done.)`
              : ''),
        );
      } else {
        const result = await swapHoodmarketsTokenForEth({
          config: swapConfig,
          amountTokens: sellAmount,
          walletProvider: provider,
          account: wallet.address as `0x${string}`,
          onStep: (step, total, label) => {
            setSwapStep(`Step ${step}/${total}: ${label}`);
          },
        });
        setTxHash(result.swapTxHash);
        setSuccessMsg(
          `You received ${result.amountOut} ETH.` +
            (result.stepsSkipped.length > 0
              ? ` (Skipped ${result.stepsSkipped.length} step(s) already done.)`
              : ''),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Swap failed');
    } finally {
      setLoading(false);
      setSwapStep(null);
    }
  }

  return (
    <div className="lp-card token-swap-card">
      <div className="token-swap-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          type="button"
          className={`btn btn-ghost btn-sm${mode === 'buy' ? ' filter-chip--active' : ''}`}
          onClick={() => setMode('buy')}
        >
          Buy
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-sm${mode === 'sell' ? ' filter-chip--active' : ''}`}
          onClick={() => setMode('sell')}
        >
          Sell
        </button>
      </div>

      <p className="section-label">
        {mode === 'buy' ? 'Buy on hood.markets' : 'Sell on hood.markets'}
      </p>
      <p className="muted token-swap-note">
        {oneClick ? (
          <>
            {mode === 'buy'
              ? 'One wallet confirmation — the swap helper wraps ETH and routes through the v4 pool for you.'
              : 'Approve once (if needed), then sell in one transaction. ETH is sent to your wallet.'}
          </>
        ) : (
          <>
            Hoodmarkets pools use Uniswap v4 with a custom hook — MetaMask may ask for several
            confirmations (wrap/approve/swap). Steps you already finished are skipped automatically.
          </>
        )}
      </p>

      {mode === 'buy' ? (
        <>
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
        </>
      ) : (
        <>
          <div className="initial-buy-presets" style={{ marginBottom: '0.75rem' }}>
            {SELL_PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                className={`btn btn-ghost btn-sm${sellPct === Number(pct) ? ' filter-chip--active' : ''}`}
                onClick={() => {
                  setSellPct(Number(pct));
                  setAmountTokens(`${pct}%`);
                }}
              >
                {pct}%
              </button>
            ))}
          </div>
          <label className="token-swap-field">
            <span className="muted">Amount (${sym})</span>
            <input
              className="lp-input"
              type="text"
              inputMode="decimal"
              value={amountTokens}
              onChange={(e) => {
                setSellPct(null);
                setAmountTokens(e.target.value);
              }}
              placeholder="1000"
            />
          </label>
          {amountTokens.endsWith('%') ? (
            <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
              Sells {amountTokens.trim()} of your wallet balance at confirm time.
            </p>
          ) : null}
        </>
      )}

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: '0.75rem' }}
        disabled={loading}
        onClick={() => void onSwap()}
      >
        {loading
          ? (swapStep ?? 'Confirm in wallet…')
          : successMsg
            ? mode === 'buy'
              ? 'Buy again'
              : 'Sell again'
            : mode === 'buy'
              ? `Buy $${sym}`
              : `Sell $${sym}`}
      </button>

      {error ? (
        <p className="error" style={{ marginTop: '0.75rem' }}>
          {error}
          {/base fee|max fee per gas/i.test(error) ? (
            <>
              {' '}
              Click again — earlier steps are saved and only the remaining step(s) will run.
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
