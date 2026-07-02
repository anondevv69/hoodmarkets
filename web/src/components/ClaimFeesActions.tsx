import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState } from 'react';
import { claimTradingFees, collectPoolFees } from '../api';
import { txUrl } from '../chain';

export function ClaimFeesActions({
  tokenAddress,
  feeRecipientAddress,
}: {
  tokenAddress: string;
  feeRecipientAddress: string;
}) {
  const { authenticated, getAccessToken, login } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address?.toLowerCase();
  const isFeeOwner =
    walletAddress && feeRecipientAddress.toLowerCase() === walletAddress;

  const [collecting, setCollecting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  if (!authenticated) {
    return (
      <div className="lp-card claim-fees-card">
        <p className="section-label">Trading fees</p>
        <p className="muted">Sign in with your fee wallet to collect and claim LP trading fees.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={login} style={{ marginTop: '0.75rem' }}>
          Sign in to claim
        </button>
      </div>
    );
  }

  if (!isFeeOwner) {
    return (
      <div className="lp-card claim-fees-card">
        <p className="section-label">Trading fees</p>
        <p className="muted">
          Connect the fee recipient wallet ({feeRecipientAddress.slice(0, 6)}…
          {feeRecipientAddress.slice(-4)}) to collect and claim fees.
        </p>
      </div>
    );
  }

  async function onCollect() {
    setError(null);
    setMessage(null);
    setTxHash(null);
    setCollecting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const out = await collectPoolFees(token, tokenAddress, walletAddress);
      setMessage(out.message);
      if (out.txHash) setTxHash(out.txHash);
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
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const out = await claimTradingFees(token, tokenAddress, walletAddress);
      setMessage(out.message);
      if (out.txHash) setTxHash(out.txHash);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="lp-card claim-fees-card">
      <p className="section-label">Trading fees</p>
      <p className="muted" style={{ marginBottom: '0.75rem' }}>
        Pull pool fees into the locker, then claim WETH to your wallet. Gas is paid by hood.markets.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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
          {claiming ? 'Claiming…' : '2. Claim fees'}
        </button>
      </div>
      {message ? <p className="muted" style={{ marginTop: '0.75rem' }}>{message}</p> : null}
      {txHash ? (
        <p className="mono" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          <a href={txUrl(txHash)} target="_blank" rel="noreferrer">
            {txHash.slice(0, 10)}…
          </a>
        </p>
      ) : null}
      {error ? (
        <p className="error" style={{ marginTop: '0.75rem' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
