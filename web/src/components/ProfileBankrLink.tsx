import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import { createWalletClient, custom, type Address } from 'viem';
import { robinhood } from '../chain';
import {
  fetchLinkBankrChallenge,
  linkBankrWallet,
  unlinkBankrWallet,
  type MyDeployerProfileResponse,
} from '../api';
import { shortenAddress } from '../chain';
import { openWalletProfile } from '../lib/deployerProfileRoute';

export function ProfileBankrLink({
  profile,
  onUpdated,
}: {
  profile: Pick<
    MyDeployerProfileResponse,
    'bankrLinked' | 'bankrWallet' | 'bankrLaunchCount'
  > | null;
  onUpdated: () => Promise<void>;
}) {
  const { getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customWallet, setCustomWallet] = useState('');

  const bankrLinked = profile?.bankrLinked ?? false;
  const bankrWallet = profile?.bankrWallet ?? null;
  const bankrLaunchCount = profile?.bankrLaunchCount ?? 0;

  const handleLink = useCallback(async () => {
    setError(null);
    if (!wallet?.address) {
      setError('Connect a wallet first.');
      return;
    }
    const target = customWallet.trim() || wallet.address;
    if (!/^0x[a-fA-F0-9]{40}$/.test(target)) {
      setError('Enter a valid 0x wallet address.');
      return;
    }

    setLinking(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');

      const challenge = await fetchLinkBankrChallenge(token, target);
      const provider = await wallet.getEthereumProvider();
      const client = createWalletClient({
        account: target as Address,
        chain: robinhood,
        transport: custom(provider as Parameters<typeof custom>[0]),
      });
      const signature = await client.signMessage({
        account: target as Address,
        message: challenge.message,
      });

      await linkBankrWallet(token, {
        walletAddress: target,
        signature,
        expiresAtMs: challenge.expiresAtMs,
      });
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not link Bankr wallet.');
    } finally {
      setLinking(false);
    }
  }, [customWallet, getAccessToken, onUpdated, wallet]);

  const handleUnlink = useCallback(async () => {
    setError(null);
    setUnlinking(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      await unlinkBankrWallet(token);
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unlink Bankr wallet.');
    } finally {
      setUnlinking(false);
    }
  }, [getAccessToken, onUpdated]);

  return (
    <div className="lp-card profile-linked-account">
      <p className="section-label">Bankr wallet</p>
      {bankrLinked && bankrWallet ? (
        <div className="profile-x-linked">
          <span className="lp-mono">{shortenAddress(bankrWallet)}</span>
          <p className="muted token-fee-note">
            {bankrLaunchCount === 1
              ? '1 @bankrbot launch attributed to this wallet'
              : `${bankrLaunchCount} @bankrbot launches attributed to this wallet`}
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => openWalletProfile(bankrWallet)}
          >
            View public profile
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void handleUnlink()}
            disabled={unlinking}
            style={{ marginLeft: '0.35rem' }}
          >
            {unlinking ? 'Unlinking…' : 'Unlink'}
          </button>
        </div>
      ) : (
        <div className="profile-x-unlinked">
          <p className="muted">
            Link the wallet you use with @bankrbot to see Bankr launches on your profile.
          </p>
          <label className="profile-bankr-field">
            <span className="muted">Bankr wallet (optional)</span>
            <input
              className="lp-input"
              type="text"
              placeholder={wallet?.address ? shortenAddress(wallet.address) : '0x…'}
              value={customWallet}
              onChange={(e) => setCustomWallet(e.target.value)}
            />
          </label>
          <p className="muted token-fee-note">
            Leave blank to use your connected wallet. Sign a message to prove ownership — switch
            accounts in your wallet if your Bankr wallet is different.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleLink()}
            disabled={linking}
          >
            {linking ? 'Confirm in wallet…' : 'Link Bankr wallet'}
          </button>
        </div>
      )}
      {error ? <p className="error" style={{ marginTop: '0.75rem' }}>{error}</p> : null}
    </div>
  );
}
