import { useWebAuth } from '../auth/WebAuthContext';
import { useActiveWallet } from '../hooks/useActiveWallet';
import { useCallback, useState } from 'react';
import { createWalletClient, custom, getAddress, type Address } from 'viem';
import { robinhood } from '../chain';
import {
  fetchLinkBankrChallenge,
  linkBankrWallet,
  unlinkBankrWallet,
  type MyDeployerProfileResponse,
} from '../api';
import { fetchBankrWalletAddress, signMessageWithBankr } from '../auth/walletAuthApi';
import { shortenAddress } from '../chain';
import { openWalletProfile } from '../lib/deployerProfileRoute';

type LinkMode = 'wallet' | 'bankr';

function walletsMatch(a: string, b: string): boolean {
  try {
    return getAddress(a) === getAddress(b);
  } catch {
    return false;
  }
}

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
  const { getAccessToken, authMethod } = useWebAuth();
  const wallet = useActiveWallet();

  const [linkMode, setLinkMode] = useState<LinkMode>('wallet');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customWallet, setCustomWallet] = useState('');
  const [bankrApiKey, setBankrApiKey] = useState('');

  const bankrLinked = profile?.bankrLinked ?? false;
  const bankrWallet = profile?.bankrWallet ?? null;
  const bankrLaunchCount = profile?.bankrLaunchCount ?? 0;

  const handleLinkWithWallet = useCallback(async () => {
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
    if (customWallet.trim() && !walletsMatch(customWallet.trim(), wallet.address)) {
      setError(
        `Your browser wallet is ${shortenAddress(wallet.address)}, not ${shortenAddress(target)}. Switch to that account in your wallet extension, or use "Bankr API key" below — pasting an address alone cannot prove ownership.`,
      );
      return;
    }

    setLinking(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');

      const challenge = await fetchLinkBankrChallenge(token, target);
      const provider = await wallet.getEthereumProvider();
      const client = createWalletClient({
        account: getAddress(target),
        chain: robinhood,
        transport: custom(provider as Parameters<typeof custom>[0]),
      });
      const signature = await client.signMessage({
        account: getAddress(target) as Address,
        message: challenge.message,
      });

      await linkBankrWallet(token, {
        walletAddress: target,
        signature,
        expiresAtMs: challenge.expiresAtMs,
      });
      await onUpdated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not link Bankr wallet.';
      if (/not been authorized by the user/i.test(msg)) {
        setError(
          `Wallet rejected the sign request. If ${shortenAddress(target)} is your Bankr wallet, use "Bankr API key" instead — MetaMask/Rainbow cannot sign for a different address.`,
        );
      } else {
        setError(msg);
      }
    } finally {
      setLinking(false);
    }
  }, [customWallet, getAccessToken, onUpdated, wallet]);

  const handleLinkWithBankrApi = useCallback(async () => {
    setError(null);
    const apiKey = bankrApiKey.trim();
    if (!apiKey.startsWith('bk_')) {
      setError('Paste your Bankr API key (starts with bk_).');
      return;
    }

    setLinking(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');

      const bankrAddress = await fetchBankrWalletAddress(apiKey);
      const challenge = await fetchLinkBankrChallenge(token, bankrAddress);
      const signature = await signMessageWithBankr(apiKey, challenge.message);

      await linkBankrWallet(token, {
        walletAddress: bankrAddress,
        signature,
        expiresAtMs: challenge.expiresAtMs,
      });
      setBankrApiKey('');
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not link Bankr wallet.');
    } finally {
      setLinking(false);
    }
  }, [bankrApiKey, getAccessToken, onUpdated]);

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
          <div className="profile-x-linked-head">
            <span className="lp-mono">{shortenAddress(bankrWallet)}</span>
            <span className="profile-link-badge profile-link-badge--verified">Verified</span>
          </div>
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
          {authMethod === 'bankr' ? (
            <p className="muted token-fee-note">
              You signed in with Bankr — your Bankr wallet should link automatically after refresh.
            </p>
          ) : null}
          <div className="launch-mode-row" role="radiogroup" aria-label="Bankr link method">
            <label className={`launch-mode-option${linkMode === 'wallet' ? ' active' : ''}`}>
              <span className="launch-mode-title">
                <input
                  type="radio"
                  name="bankrLinkMode"
                  checked={linkMode === 'wallet'}
                  onChange={() => setLinkMode('wallet')}
                />
                Browser wallet
              </span>
            </label>
            <label className={`launch-mode-option${linkMode === 'bankr' ? ' active' : ''}`}>
              <span className="launch-mode-title">
                <input
                  type="radio"
                  name="bankrLinkMode"
                  checked={linkMode === 'bankr'}
                  onChange={() => setLinkMode('bankr')}
                />
                Bankr API key
              </span>
            </label>
          </div>
          {linkMode === 'wallet' ? (
            <>
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
                Leave blank if your connected wallet <em>is</em> your Bankr wallet. Only works when
                that exact account is selected in MetaMask/Rainbow — do not paste a different
                address here.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleLinkWithWallet()}
                disabled={linking}
              >
                {linking ? 'Confirm in wallet…' : 'Link Bankr wallet'}
              </button>
            </>
          ) : (
            <>
              <label className="profile-bankr-field">
                <span className="muted">Bankr API key</span>
                <input
                  className="lp-input"
                  type="password"
                  placeholder="bk_…"
                  value={bankrApiKey}
                  onChange={(e) => setBankrApiKey(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <p className="muted token-fee-note">
                Use this if your Bankr wallet is not in MetaMask/Rainbow. Paste your{' '}
                <code>bk_</code> key from{' '}
                <a href="https://bankr.bot/api" target="_blank" rel="noopener noreferrer">
                  bankr.bot/api
                </a>{' '}
                — it is used only to sign a one-time verification message and is not stored on
                hood.markets.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleLinkWithBankrApi()}
                disabled={linking}
              >
                {linking ? 'Signing via Bankr…' : 'Link with Bankr API key'}
              </button>
            </>
          )}
        </div>
      )}
      {error ? <p className="error" style={{ marginTop: '0.75rem' }}>{error}</p> : null}
    </div>
  );
}
