import { useWebLogin, useActiveWallet } from '../hooks/useActiveWallet';
import { useCallback, useEffect, useState } from 'react';
import { createPublicClient, custom, erc20Abi, formatUnits } from 'viem';
import { robinhood, txUrl } from '../chain';
import { ensureRobinhoodChainInWallet } from '../lib/ensureRobinhoodChain';
import { formatSwapError } from '../lib/formatSwapError';
import {
  formatHumanTokenAmount,
  formatTokenBalance,
  tokenAmountFromPercent,
} from '../lib/formatTokenBalance';
import { isSimpleLaunchDeployment } from '../lib/launchType';
import {
  fetchTokenSwapConfig,
  swapEthForHoodmarketsToken,
  swapHoodmarketsTokenForEth,
  type TokenSwapConfig,
} from '../lib/robinhoodSwap';
import {
  swapEthForV3Token,
  swapV3TokenForEth,
} from '../lib/robinhoodV3Swap';

const BUY_PRESETS = ['0.001', '0.005', '0.01', '0.02'] as const;
const SELL_PRESETS = ['25', '50', '75', '100'] as const;

type SwapMode = 'buy' | 'sell';

export function TokenSwap({
  tokenAddress,
  symbol,
  suggestedBuyEth,
  poolId,
  factoryAddress,
  variant = 'card',
}: {
  tokenAddress: string;
  symbol: string;
  suggestedBuyEth?: string;
  poolId?: string | null;
  factoryAddress?: string | null;
  variant?: 'card' | 'sidebar';
}) {
  const { authenticated, login } = useWebLogin();
  const wallet = useActiveWallet();
  const [mode, setMode] = useState<SwapMode>('buy');
  const [amountEth, setAmountEth] = useState(suggestedBuyEth?.trim() || '0.005');
  const [amountTokens, setAmountTokens] = useState('');
  const [sellPct, setSellPct] = useState<number | null>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [config, setConfig] = useState<TokenSwapConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapStep, setSwapStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (suggestedBuyEth?.trim()) setAmountEth(suggestedBuyEth.trim());
  }, [suggestedBuyEth]);

  const isSimpleLaunch = isSimpleLaunchDeployment({ poolId, factoryAddress });

  useEffect(() => {
    if (isSimpleLaunch) return;
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
  }, [tokenAddress, isSimpleLaunch]);

  const refreshTokenBalance = useCallback(async () => {
    if (!authenticated || !wallet?.address) {
      setTokenBalance(null);
      return;
    }
    setBalanceLoading(true);
    try {
      const provider = await wallet.getEthereumProvider();
      const publicClient = createPublicClient({
        chain: robinhood,
        transport: custom(provider as Parameters<typeof custom>[0]),
      });
      const token = tokenAddress as `0x${string}`;
      let decimals = 18;
      try {
        decimals = Number(
          await publicClient.readContract({
            address: token,
            abi: erc20Abi,
            functionName: 'decimals',
          }),
        );
      } catch {
        decimals = 18;
      }
      const bal = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [wallet.address as `0x${string}`],
      });
      setTokenDecimals(decimals);
      setTokenBalance(bal);
    } catch {
      setTokenBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [authenticated, tokenAddress, wallet]);

  useEffect(() => {
    void refreshTokenBalance();
  }, [refreshTokenBalance, txHash]);

  useEffect(() => {
    if (sellPct == null || tokenBalance == null || tokenBalance <= 0n) return;
    setAmountTokens(tokenAmountFromPercent(tokenBalance, sellPct, tokenDecimals));
  }, [tokenBalance, tokenDecimals, sellPct]);

  useEffect(() => {
    if (mode === 'sell') void refreshTokenBalance();
  }, [mode, refreshTokenBalance]);

  function applySellPreset(pct: number) {
    setSellPct(pct);
    if (tokenBalance != null && tokenBalance > 0n) {
      setAmountTokens(tokenAmountFromPercent(tokenBalance, pct, tokenDecimals));
      return;
    }
    setAmountTokens(`${pct}%`);
  }

  if (!isSimpleLaunch && !config) return null;

  const sym = symbol.replace(/^\$/, '');
  const oneClick = isSimpleLaunch ? true : Boolean(config?.swapHelper);
  const sidebar = variant === 'sidebar';
  const balanceLabel =
    tokenBalance != null ? formatTokenBalance(tokenBalance, tokenDecimals) : balanceLoading ? '…' : '—';
  const sellDisplayAmount =
    amountTokens.trim().endsWith('%') && tokenBalance != null && tokenBalance > 0n
      ? tokenAmountFromPercent(tokenBalance, Number(amountTokens.replace('%', '')), tokenDecimals)
      : amountTokens;
  const sellHeroAmount = amountTokens.trim()
    ? amountTokens.trim()
    : authenticated
      ? balanceLoading
        ? '…'
        : balanceLabel
      : '0';
  const displayAmount = mode === 'buy' ? amountEth : sellHeroAmount;
  const showingBalance = mode === 'sell' && !amountTokens.trim() && authenticated;

  async function resolveSellAmount(
    provider: unknown,
    token: `0x${string}`,
    walletAddress: `0x${string}`,
  ): Promise<string> {
    if (!amountTokens.trim().endsWith('%')) return amountTokens;
    const pct = Number(amountTokens.trim().replace('%', ''));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw new Error('Enter a sell percentage between 1 and 100.');
    }
    const publicClient = createPublicClient({
      chain: robinhood,
      transport: custom(provider as Parameters<typeof custom>[0]),
    });
    const bal = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress],
    });
    if (bal <= 0n) throw new Error('You have no tokens to sell.');
    const slice = (bal * BigInt(Math.round(pct * 100))) / 10000n;
    if (slice <= 0n) throw new Error('Sell amount too small.');
    let decimals = 18;
    try {
      decimals = Number(
        await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'decimals',
        }),
      );
    } catch {
      decimals = 18;
    }
    return formatUnits(slice, decimals);
  }

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
      const account = wallet.address as `0x${string}`;

      if (isSimpleLaunch) {
        if (mode === 'buy') {
          const result = await swapEthForV3Token({
            tokenAddress,
            amountEth,
            walletProvider: provider,
            account,
          });
          setTxHash(result.swapTxHash);
          setSuccessMsg(`You received ${formatHumanTokenAmount(result.amountOut)} $${sym}.`);
        } else {
          const sellAmount = await resolveSellAmount(
            provider,
            tokenAddress as `0x${string}`,
            account,
          );
          const result = await swapV3TokenForEth({
            tokenAddress,
            amountTokens: sellAmount,
            walletProvider: provider,
            account,
          });
          setTxHash(result.swapTxHash);
          setSuccessMsg(`You received ${formatHumanTokenAmount(result.amountOut)} ETH.`);
        }
        return;
      }

      const swapConfig = await fetchTokenSwapConfig(tokenAddress);
      let sellAmount = amountTokens;

      if (mode === 'sell' && amountTokens.trim().endsWith('%')) {
        sellAmount = await resolveSellAmount(provider, swapConfig.tokenAddress, account);
      } else if (mode === 'sell') {
        sellAmount = amountTokens;
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
          `You received ${formatHumanTokenAmount(result.amountOut)} $${sym}.` +
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
          `You received ${formatHumanTokenAmount(result.amountOut)} ETH.` +
            (result.stepsSkipped.length > 0
              ? ` (Skipped ${result.stepsSkipped.length} step(s) already done.)`
              : ''),
        );
      }
    } catch (e) {
      setError(formatSwapError(e));
    } finally {
      setLoading(false);
      setSwapStep(null);
    }
  }

  if (sidebar) {
    return (
      <div className="tp-zone token-swap-sidebar">
        <div className="tp-buysell">
          <button
            type="button"
            className={`tp-bs-btn${mode === 'buy' ? ' buy-active' : ''}`}
            onClick={() => setMode('buy')}
          >
            Buy
          </button>
          <button
            type="button"
            className={`tp-bs-btn${mode === 'sell' ? ' sell-active' : ''}`}
            onClick={() => setMode('sell')}
          >
            Sell
          </button>
        </div>

        <div className="tp-amount-display">
          <span className="tp-amount-num lp-mono">{displayAmount || '0'}</span>
          <span className="tp-amount-unit">{mode === 'buy' ? 'ETH' : sym}</span>
          {showingBalance ? <span className="tp-amount-hint">Your balance</span> : null}
        </div>

        {mode === 'buy' ? (
          <div className="tp-presets">
            {BUY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`tp-preset${amountEth === preset ? ' active' : ''}`}
                onClick={() => setAmountEth(preset)}
              >
                {preset} ETH
              </button>
            ))}
          </div>
        ) : (
          <>
            {authenticated ? (
              <p className="tp-balance-line">
                You hold <span className="lp-mono">{balanceLabel}</span> {sym}
              </p>
            ) : (
              <p className="tp-balance-line muted">Connect wallet to see your balance</p>
            )}
            <div className="tp-presets">
              {SELL_PRESETS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  className={`tp-preset${sellPct === Number(pct) ? ' active' : ''}`}
                  onClick={() => applySellPreset(Number(pct))}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </>
        )}

        <label className="token-swap-field token-swap-field--sidebar">
          <span className="muted">{mode === 'buy' ? 'Amount (ETH)' : `Amount (${sym})`}</span>
          <input
            className="lp-input"
            type="text"
            inputMode="decimal"
            value={mode === 'buy' ? amountEth : amountTokens}
            onChange={(e) => {
              if (mode === 'buy') setAmountEth(e.target.value);
              else {
                setSellPct(null);
                setAmountTokens(e.target.value);
              }
            }}
            placeholder={mode === 'buy' ? '0.005' : '0'}
          />
        </label>

        <button type="button" className="tp-cta" disabled={loading} onClick={() => void onSwap()}>
          {loading
            ? (swapStep ?? 'Confirm in wallet…')
            : !authenticated
              ? 'Connect wallet to trade'
              : mode === 'buy'
                ? `Buy $${sym}`
                : `Sell $${sym}`}
        </button>

        {oneClick && !isSimpleLaunch ? (
          <p className="tp-footnote">
            {mode === 'buy'
              ? 'One confirmation — swap helper routes through the pool.'
              : 'Approve once if needed, then sell in one transaction.'}
          </p>
        ) : null}

        {error ? <p className="error token-swap-sidebar-error">{error}</p> : null}
        {successMsg ? <p className="token-swap-success">{successMsg}</p> : null}
        {txHash ? (
          <p className="muted token-swap-sidebar-tx">
            <a href={txUrl(txHash)} target="_blank" rel="noreferrer">
              View transaction
            </a>
          </p>
        ) : null}
      </div>
    );
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
                onClick={() => applySellPreset(Number(pct))}
              >
                {pct}%
              </button>
            ))}
          </div>
          {authenticated ? (
            <p className="muted" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              Balance: {balanceLabel} {sym}
            </p>
          ) : null}
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
              placeholder="0"
            />
          </label>
          {amountTokens.trim().endsWith('%') && tokenBalance == null ? (
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
