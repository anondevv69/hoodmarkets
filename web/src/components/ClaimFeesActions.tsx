import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import { fetchTokenFeeStatus, type TokenFeeStatus } from '../api';
import { txUrl } from '../chain';
import { isHoodmarketsPlatformFeeRecipient } from '../lib/feeRecipientDisplay';
import { isSimpleLaunchDeployment } from '../lib/launchType';
import {
  claimV3TradingFeesFromWallet,
  claimV4LockerFeesFromWallet,
  collectV4PoolFeesFromWallet,
} from '../lib/walletFeeClaims';

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
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
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
      if (login) login();
      throw new Error('Connect a wallet to continue. You pay gas.');
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
      setError(e instanceof Error ? e.message : 'Collect failed');
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
      setError(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setClaiming(false);
    }
  }

  const pending = feeStatus?.pendingWethHuman;
  const hasPending = !isV3 && pending && Number.parseFloat(pending) > 0;
  const lastClaimLabel = feeStatus?.feeClaimedAt
    ? new Date(feeStatus.feeClaimedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : statusLoading
      ? '…'
      : 'Never';

  const walletNote = wallet
    ? 'You pay gas for on-chain transactions.'
    : 'Connect a wallet to claim. You pay gas.';

  if (variant === 'sidebar') {
    return (
      <>
        <div className="tp-info-row">
          <span className="tp-info-k">Last fee claim</span>
          <span className="tp-info-v">{lastClaimLabel}</span>
        </div>

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

        <p className="tp-footnote">{walletNote}</p>

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
      <p className="muted claim-fees-intro">{walletNote}</p>

      {statusLoading ? (
        <p className="muted claim-fees-status">Checking fee status…</p>
      ) : feeStatus ? (
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
