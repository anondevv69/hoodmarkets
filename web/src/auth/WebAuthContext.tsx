import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAccount, useDisconnect, useSignMessage } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
  type StoredWebSession,
} from './session';
import {
  fetchBankrWalletAddress,
  fetchWalletLoginChallenge,
  signMessageWithBankr,
  verifyWalletLogin,
} from './walletAuthApi';

export type WebAuthMethod = 'rainbow' | 'bankr' | null;

type WebAuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  walletAddress: string | null;
  walletKind: string | null;
  authMethod: WebAuthMethod;
  getAccessToken: () => Promise<string | null>;
  connectWallet: () => void;
  loginWithBankr: (apiKey: string) => Promise<void>;
  logout: () => void;
  authError: string | null;
  clearAuthError: () => void;
};

const WebAuthContext = createContext<WebAuthContextValue | null>(null);

export function WebAuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();
  const [session, setSession] = useState<StoredWebSession | null>(null);
  const [authMethod, setAuthMethod] = useState<WebAuthMethod>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    setSession(readStoredSession());
    setReady(true);
  }, []);

  const completeWalletLogin = useCallback(
    async (walletAddress: string, sign: (message: string) => Promise<string>, walletKind: string) => {
      const challenge = await fetchWalletLoginChallenge(walletAddress);
      const signature = await sign(challenge.message);
      const verified = await verifyWalletLogin({
        walletAddress,
        message: challenge.message,
        signature,
        walletKind,
      });
      const stored: StoredWebSession = {
        token: verified.token,
        walletAddress: verified.walletAddress,
        walletKind: verified.walletKind,
        expiresAt: verified.expiresAt,
      };
      writeStoredSession(stored);
      setSession(stored);
      setAuthMethod(walletKind === 'bankr-evm' ? 'bankr' : 'rainbow');
      setAuthError(null);
    },
    [],
  );

  useEffect(() => {
    if (!ready || signing || authMethod === 'bankr') return;
    if (!isConnected || !address) return;
    if (session?.walletAddress?.toLowerCase() === address.toLowerCase()) return;

    let cancelled = false;
    setSigning(true);
    void (async () => {
      try {
        await completeWalletLogin(address, (message) => signMessageAsync({ message }), 'injected');
      } catch (e) {
        if (!cancelled) {
          setAuthError(e instanceof Error ? e.message : 'Wallet sign-in failed.');
          disconnect();
          clearStoredSession();
          setSession(null);
          setAuthMethod(null);
        }
      } finally {
        if (!cancelled) setSigning(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    signing,
    authMethod,
    isConnected,
    address,
    session?.walletAddress,
    completeWalletLogin,
    signMessageAsync,
    disconnect,
  ]);

  const connectWallet = useCallback(() => {
    setAuthError(null);
    openConnectModal?.();
  }, [openConnectModal]);

  const loginWithBankr = useCallback(
    async (apiKey: string) => {
      setAuthError(null);
      const trimmed = apiKey.trim();
      if (!trimmed.startsWith('bk_')) {
        throw new Error('Bankr API key must start with bk_');
      }
      const walletAddress = await fetchBankrWalletAddress(trimmed);
      await completeWalletLogin(
        walletAddress,
        (message) => signMessageWithBankr(trimmed, message),
        'bankr-evm',
      );
      if (isConnected) disconnect();
    },
    [completeWalletLogin, disconnect, isConnected],
  );

  const logout = useCallback(() => {
    clearStoredSession();
    setSession(null);
    setAuthMethod(null);
    setAuthError(null);
    if (isConnected) disconnect();
  }, [disconnect, isConnected]);

  const getAccessToken = useCallback(async () => {
    const s = session ?? readStoredSession();
    return s?.token ?? null;
  }, [session]);

  const value = useMemo<WebAuthContextValue>(
    () => ({
      ready,
      authenticated: !!session?.token,
      walletAddress: session?.walletAddress ?? null,
      walletKind: session?.walletKind ?? null,
      authMethod,
      getAccessToken,
      connectWallet,
      loginWithBankr,
      logout,
      authError,
      clearAuthError: () => setAuthError(null),
    }),
    [
      ready,
      session,
      authMethod,
      getAccessToken,
      connectWallet,
      loginWithBankr,
      logout,
      authError,
    ],
  );

  return <WebAuthContext.Provider value={value}>{children}</WebAuthContext.Provider>;
}

export function useWebAuth(): WebAuthContextValue {
  const ctx = useContext(WebAuthContext);
  if (!ctx) throw new Error('useWebAuth must be used within WebAuthProvider');
  return ctx;
}
