import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import {
  claimTradingFees,
  claimTradingFeesPublic,
  collectPoolFees,
  collectPoolFeesPublic,
  fetchTokenFeeStatus,
  type TokenFeeStatus,
} from '../api';
import { txUrl, shortenAddress } from '../chain';
import { isHoodmarketsPlatformFeeRecipient } from '../lib/feeRecipientDisplay';
import { isSimpleLaunchDeployment } from '../lib/launchType';
import { openWalletProfile } from '../lib/deployerProfileRoute';

export function ClaimFeesActions({
  tokenAddress,
  feeRecipientAddress,
  feeRecipientLabel,
  poolId,
  factoryAddress,
  /** When true (token page), anyone can trigger collect/claim — funds always go to fee recipient. */
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
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address?.toLowerCase();
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
  /** Prefer catalog poolId/factory — fee-status loads async and wrongly defaulted to V4 while pending. */
  const isV3 =
    feeStatus?.feeModel === 'v4'
      ? false
      : feeStatus?.feeModel === 'v3' || catalogSimple;

  async function onCollect() {
    setError(null);
    setMessage(null);
    setTxHash(null);
    setCollecting(true);
    try {
      const out = publicCollect
        ? await collectPoolFeesPublic(tokenAddress)
        : await (async () => {
            const token = await getAccessToken();
            if (!token) throw new Error('Not signed in');
            return collectPoolFees(token, tokenAddress, walletAddress);
          })();
      if (!out.ok && out.error) throw new Error(out.error);
      setMessage(out.message);
      if (out.txHash) setTxHash(out.txHash);
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
      const out = publicCollect
        ? await claimTradingFeesPublic(tokenAddress)
        : await (async () => {
            const token = await getAccessToken();
            if (!token) throw new Error('Not signed in');
            return claimTradingFees(token, tokenAddress, walletAddress);
          })();
      if (!out.ok && out.error) throw new Error(out.error);
      setMessage(
        out.feeAmountHuman
          ? `${out.message ?? 'Claimed'} (${out.feeAmountHuman} WETH)`
          : out.message,
      );
      if (out.txHash) setTxHash(out.txHash);
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
            {claiming ? 'Collecting…' : 'Collect trading fees'}
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
          {platformFees
            ? 'Anyone can trigger this claim. Fees go to the hood.markets treasury — the caller only pays gas.'
            : 'Anyone can trigger this claim. WETH is sent to the fee recipient — hood.markets pays gas.'}
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
        {platformFees ? (
          <>
            This launch hit the 24h self-fee limit — trading fees go to the hood.markets platform
            wallet ({shortenAddress(feeRecipientAddress)}). Anyone can trigger the on-chain claim;
            hood.markets pays gas and WETH is sent to the platform treasury.
          </>
        ) : isV3 ? (
          <>
            Simple (V3) launch: swap fees accrue in the Uniswap V3 pool. Anyone can trigger{' '}
            <strong>Collect trading fees</strong> below — that pulls the 95% creator slice into the
            Holder NFT contract. Each share holder then claims their pro-rata amount via{' '}
            <strong>Claim my trading fees</strong> on the Holder NFTs panel (hood.markets pays gas
            for the collect step only).
          </>
        ) : publicCollect ? (
          <>
            Pro (V4) launches: pool fees go into a locker, then WETH is claimed to the{' '}
            <button
              type="button"
              className="btn-link"
              onClick={() => openWalletProfile(feeRecipientAddress)}
            >
              fee recipient
            </button>{' '}
            ({shortenAddress(feeRecipientAddress)}). hood.markets pays gas.
          </>
        ) : (
          <>
            Pull pool fees into the locker, then claim WETH to your wallet. Gas is paid by
            hood.markets.
          </>
        )}
      </p>

      {statusLoading ? (
        <p className="muted claim-fees-status">Checking fee status…</p>
      ) : feeStatus ? (
        <p className="claim-fees-status">
          {isV3 ? (
            <span className="muted">
              V3: collect pulls fees into the Holder NFT contract; share holders claim their slice
              separately.
            </span>
          ) : hasPending ? (
            <span className="lp-display">{pending} WETH in fee locker</span>
          ) : (
            <span className="muted">No WETH in the fee locker yet — collect pool fees first</span>
          )}
          {feeStatus.feeClaimedAt ? (
            <span className="muted">
              {' '}
              · Last claim recorded {new Date(feeStatus.feeClaimedAt).toLocaleString()}
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
            {claiming ? 'Collecting…' : 'Collect trading fees'}
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
