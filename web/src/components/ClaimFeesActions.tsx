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
import { openWalletProfile } from '../lib/deployerProfileRoute';

export function ClaimFeesActions({
  tokenAddress,
  feeRecipientAddress,
  feeRecipientLabel,
  /** When true (token page), anyone can trigger collect/claim — funds always go to fee recipient. */
  publicCollect = false,
}: {
  tokenAddress: string;
  feeRecipientAddress: string;
  feeRecipientLabel?: string;
  publicCollect?: boolean;
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
    if (platformFees) return;
    setStatusLoading(true);
    try {
      const status = await fetchTokenFeeStatus(tokenAddress);
      setFeeStatus(status);
    } catch {
      setFeeStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [platformFees, tokenAddress]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  if (platformFees) {
    return null;
  }

  const showActions = publicCollect || (authenticated && isFeeOwner);
  if (!showActions) {
    return null;
  }

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
  const hasPending = pending && Number.parseFloat(pending) > 0;

  return (
    <div className="lp-card claim-fees-card">
      <p className="section-label">Trading fees</p>
      <p className="muted claim-fees-intro">
        {publicCollect ? (
          <>
            Pool trading fees accrue in the Uniswap position until someone collects them into the
            locker, then claims WETH to the{' '}
            <button
              type="button"
              className="btn-link"
              onClick={() => openWalletProfile(feeRecipientAddress)}
            >
              fee recipient
            </button>{' '}
            ({shortenAddress(feeRecipientAddress)}). Anyone can trigger these steps — hood.markets
            pays gas and funds always go to the fee recipient.
          </>
        ) : (
          <>
            Pull pool fees into the locker, then claim WETH to your wallet. Gas is paid by
            hood.markets. Fees only build up after others trade your pool.
          </>
        )}
      </p>

      {statusLoading ? (
        <p className="muted claim-fees-status">Checking locker balance…</p>
      ) : feeStatus ? (
        <p className="claim-fees-status">
          {hasPending ? (
            <span className="lp-display">{pending} WETH</span>
          ) : (
            <span className="muted">No WETH in the fee locker yet</span>
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
