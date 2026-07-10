import { useWebAuth } from '../auth/WebAuthContext';
import { useActiveWallet } from '../hooks/useActiveWallet';
import { useCallback, useEffect, useState } from 'react';
import { fetchTokenFeeStatus, type TokenFeeStatus } from '../api';
import { txUrl } from '../chain';
import { isHoodmarketsPlatformFeeRecipient } from '../lib/feeRecipientDisplay';
import { isSimpleLaunchDeployment } from '../lib/launchType';
import { formatClaimError, shouldReportClaimError } from '../lib/formatClaimError';
import { reportClientError } from '../lib/reportClientError';
import {
  claimV3TradingFeesFromWallet,
  claimV4LockerFeesFromWallet,
  collectV4PoolFeesFromWallet,
} from '../lib/walletFeeClaims';

function V3FeePoolMeter({ pool }: { pool: NonNullable<TokenFeeStatus['v3Pool']> }) {
  const pct = Math.round(Math.max(0, Math.min(1, pool.progress)) * 100);
  const surplus = Number.parseFloat(pool.surplusWethHuman) || 0;
  const title =
    pool.statusLabel === 'ready'
      ? 'Ready to claim'
      : pool.statusLabel === 'filling'
        ? 'Filling toward next claim'
        : 'Waiting on new swap fees';

  const detail =
    pool.statusLabel === 'ready'
      ? surplus > 0
        ? `~${pool.surplusWethHuman} WETH is ready to pay share holders.`
        : `~${pool.uncollectedWethHuman} WETH in the LP is ready to pull and pay share holders.`
      : pool.statusLabel === 'filling'
        ? `~${pool.estimatedIncomingWethHuman} WETH waiting in the LP` +
          (Number.parseFloat(pool.remainingWethHuman) > 0
            ? ` · ~${pool.remainingWethHuman} WETH more trading needed before the next payout`
            : '') +
          '.'
        : 'No new swap fees in the locked LP since the last payout.';

  return (
    <div className={`claim-fee-meter claim-fee-meter--${pool.statusLabel}`}>
      <div className="claim-fee-meter-head">
        <span className="claim-fee-meter-title">{title}</span>
        <span className="claim-fee-meter-pct lp-mono">{pct}%</span>
      </div>
      <div
        className="claim-fee-meter-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={title}
      >
        <div className="claim-fee-meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="claim-fee-meter-detail muted">{detail}</p>
      {pool.statusLabel === 'filling' || surplus > 0 ? (
        <div className="claim-fee-meter-stats">
          <span>
            In LP <strong className="lp-mono">{pool.uncollectedWethHuman}</strong> WETH
          </span>
          {pool.statusLabel === 'filling' && Number.parseFloat(pool.remainingWethHuman) > 0 ? (
            <span>
              Still need <strong className="lp-mono">{pool.remainingWethHuman}</strong> WETH
            </span>
          ) : null}
          {surplus > 0 ? (
            <span>
              Claimable now <strong className="lp-mono">{pool.surplusWethHuman}</strong> WETH
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ClaimFeesActions({
  tokenAddress,
  feeRecipientAddress,
  feeRecipientLabel,
  poolId,
  factoryAddress,
  publicCollect = false,
  variant = 'card',
}: {
  tokenAddress: string;
  feeRecipientAddress: string;
  feeRecipientLabel?: string;
  poolId?: string | null;
  factoryAddress?: string | null;
  publicCollect?: boolean;
  variant?: 'card' | 'sidebar';
}) {
  const { authenticated, connectWallet } = useWebAuth();
  const wallet = useActiveWallet();
  const walletAddress = wallet?.address?.toLowerCase();
  const platformFees = isHoodmarketsPlatformFeeRecipient(feeRecipientLabel);
  const isFeeOwner =
    !platformFees &&
    walletAddress &&
    feeRecipientAddress.toLowerCase() === walletAddress;

  const [feeStatus, setFeeStatus] = useState<TokenFeeStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const status = await fetchTokenFeeStatus(tokenAddress);
      setFeeStatus(status);
    } catch {
      setFeeStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const showActions = platformFees
    ? publicCollect
    : publicCollect || (authenticated && isFeeOwner);
  if (!showActions) {
    return null;
  }

  const catalogSimple = isSimpleLaunchDeployment({ poolId, factoryAddress });
  const isV3 =
    feeStatus?.feeModel === 'v4'
      ? false
      : feeStatus?.feeModel === 'v3' || catalogSimple;

  async function requireWallet() {
    if (!wallet) {
      if (connectWallet) connectWallet();
      throw new Error('Connect a wallet to continue.');
    }
    const provider = await wallet.getEthereumProvider();
    return { wallet, provider };
  }

  async function onCollect() {
    setError(null);
    setMessage(null);
    setTxHash(null);
    setCollecting(true);
    try {
      const { wallet: w, provider } = await requireWallet();
      const hash = await collectV4PoolFeesFromWallet({
        tokenAddress,
        walletAddress: w.address as `0x${string}`,
        ethereumProvider: provider,
      });
      setTxHash(hash);
      setMessage('Pool fees collected into the locker.');
      await refreshStatus();
    } catch (e) {
      const msg = formatClaimError(e);
      setError(msg);
      if (shouldReportClaimError(msg)) {
        reportClientError('claim-fees-collect', e, { tokenAddress });
      }
    } finally {
      setCollecting(false);
    }
  }

  async function onClaim() {
    setError(null);
    setMessage(null);
    setTxHash(null);
    setClaiming(true);
    try {
      const { wallet: w, provider } = await requireWallet();
      const hash = isV3
        ? await claimV3TradingFeesFromWallet({
            tokenAddress,
            walletAddress: w.address as `0x${string}`,
            ethereumProvider: provider,
          })
        : await claimV4LockerFeesFromWallet({
            feeRecipientAddress,
            walletAddress: w.address as `0x${string}`,
            ethereumProvider: provider,
          });
      setTxHash(hash);
      setMessage(isV3 ? 'Trading fees claim submitted.' : 'Fees claim submitted.');
      await refreshStatus();
    } catch (e) {
      const msg = formatClaimError(e);
      setError(msg);
      if (shouldReportClaimError(msg)) {
        reportClientError('claim-fees', e, {
          tokenAddress,
          feeModel: isV3 ? 'v3' : 'v4',
        });
      }
    } finally {
      setClaiming(false);
    }
  }

  const pending = feeStatus?.pendingWethHuman;
  const hasPending = !isV3 && pending && Number.parseFloat(pending) > 0;
  const v3Pool = feeStatus?.v3Pool;
  const lastClaimLabel = feeStatus?.feeClaimedAt
    ? new Date(feeStatus.feeClaimedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : statusLoading
      ? '…'
      : v3Pool &&
          (Number.parseFloat(v3Pool.accountedWethHuman) > 0 ||
            Number.parseFloat(v3Pool.fractionWethHuman) > 0 ||
            v3Pool.legacyStuckDust)
        ? 'Prior claims on-chain'
        : 'Never';

  const walletNote = 'Anyone can claim fees for fee recipients.';

  if (variant === 'sidebar') {
    return (
      <>
        <div className="tp-info-row">
          <span className="tp-info-k">Last fee claim</span>
          <span className="tp-info-v">{lastClaimLabel}</span>
        </div>

        {isV3 && v3Pool ? <V3FeePoolMeter pool={v3Pool} /> : null}

        {isV3 ? (
          <button
            type="button"
            className="tp-claim-btn"
            disabled={collecting || claiming}
            onClick={() => void onClaim()}
          >
            {claiming ? 'Claiming…' : 'Claim trading fees'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="tp-claim-btn tp-claim-btn--secondary"
              disabled={collecting || claiming}
              onClick={() => void onCollect()}
            >
              {collecting ? 'Collecting…' : 'Collect pool fees'}
            </button>
            <button
              type="button"
              className="tp-claim-btn"
              disabled={collecting || claiming}
              onClick={() => void onClaim()}
              style={{ marginTop: '0.5rem' }}
            >
              {claiming ? 'Claiming…' : 'Claim to fee recipient'}
            </button>
          </>
        )}

        <p className="tp-footnote">
          {isV3
            ? 'Anyone can claim anytime. The meter shows fees waiting in the LP toward the next payout — not a lockout.'
            : walletNote}
        </p>

        {message ? <p className="muted claim-fees-message">{message}</p> : null}
        {txHash ? (
          <p className="mono claim-fees-tx">
            <a href={txUrl(txHash)} target="_blank" rel="noreferrer">
              {txHash.slice(0, 10)}…
            </a>
          </p>
        ) : null}
        {error ? <p className="error claim-fees-error">{error}</p> : null}
      </>
    );
  }

  return (
    <div className="lp-card claim-fees-card">
      <p className="section-label">Trading fees</p>
      <p className="muted claim-fees-intro">
        {isV3
          ? 'Anyone can claim anytime. One tx pays all share holders pro-rata when new swap fees have accrued since the last payout — not a timer or lockout.'
          : walletNote}
      </p>

      {statusLoading ? (
        <p className="muted claim-fees-status">Checking fee status…</p>
      ) : feeStatus ? (
        <>
          {isV3 && v3Pool ? (
            <V3FeePoolMeter pool={v3Pool} />
          ) : (
            <p className="claim-fees-status">
              {isV3 ? (
                <span className="muted">V3: claim pulls pool fees to share holders.</span>
              ) : hasPending ? (
                <span className="lp-display">{pending} WETH in fee locker</span>
              ) : (
                <span className="muted">No WETH in the fee locker yet</span>
              )}
              {feeStatus.feeClaimedAt ? (
                <span className="muted">
                  {' '}
                  · Last claim {new Date(feeStatus.feeClaimedAt).toLocaleString()}
                </span>
              ) : null}
            </p>
          )}
          {isV3 && v3Pool && feeStatus.feeClaimedAt ? (
            <p className="muted claim-fees-status" style={{ marginTop: '0.35rem' }}>
              Last claim {new Date(feeStatus.feeClaimedAt).toLocaleString()}
            </p>
          ) : null}
        </>
      ) : null}

      <div className="claim-fees-actions">
        {isV3 ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={collecting || claiming}
            onClick={() => void onClaim()}
          >
            {claiming ? 'Claiming…' : 'Claim trading fees'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={collecting || claiming}
              onClick={() => void onCollect()}
            >
              {collecting ? 'Collecting…' : '1. Collect pool fees'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={collecting || claiming}
              onClick={() => void onClaim()}
            >
              {claiming ? 'Claiming…' : '2. Claim to fee recipient'}
            </button>
          </>
        )}
      </div>

      {message ? <p className="muted claim-fees-message">{message}</p> : null}
      {txHash ? (
        <p className="mono claim-fees-tx">
          <a href={txUrl(txHash)} target="_blank" rel="noreferrer">
            {txHash.slice(0, 10)}…
          </a>
        </p>
      ) : null}
      {error ? <p className="error claim-fees-error">{error}</p> : null}
    </div>
  );
}
