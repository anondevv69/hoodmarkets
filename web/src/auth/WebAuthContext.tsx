import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAccount, useAccountEffect, useDisconnect, useSignMessage } from 'wagmi';
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

/** Brief pause so the wallet can finish connect UI before the sign prompt. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function WebAuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, status } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();
  const [session, setSession] = useState<StoredWebSession | null>(null);
  const [authMethod, setAuthMethod] = useState<WebAuthMethod>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const signInFlightRef = useRef<string | null>(null);
  const sessionRef = useRef<StoredWebSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const stored = readStoredSession();
    setSession(stored);
    sessionRef.current = stored;
    if (stored?.walletKind === 'bankr-evm') {
      setAuthMethod('bankr');
    } else if (stored?.token) {
      setAuthMethod('rainbow');
    }
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
      sessionRef.current = stored;
      setAuthMethod(walletKind === 'bankr-evm' ? 'bankr' : 'rainbow');
      setAuthError(null);
    },
    [],
  );

  const runSignInIfNeeded = useCallback(
    async (walletAddress: string) => {
      const key = walletAddress.toLowerCase();
      if (sessionRef.current?.walletAddress?.toLowerCase() === key) return;
      if (signInFlightRef.current === key) return;

      signInFlightRef.current = key;
      setAuthError(null);
      try {
        // Wallets often miss the sign prompt if fired in the same tick as connect.
        await delay(400);
        if (signInFlightRef.current !== key) return;
        await completeWalletLogin(
          walletAddress,
          (message) => signMessageAsync({ message }),
          'injected',
        );
      } catch (e) {
        if (signInFlightRef.current === key) {
          setAuthError(e instanceof Error ? e.message : 'Wallet sign-in failed.');
          disconnect();
          clearStoredSession();
          setSession(null);
          sessionRef.current = null;
          setAuthMethod(null);
        }
      } finally {
        if (signInFlightRef.current === key) {
          signInFlightRef.current = null;
        }
      }
    },
    [completeWalletLogin, signMessageAsync, disconnect],
  );

  useAccountEffect({
    onConnect({ address: connectedAddress }) {
      if (!connectedAddress) return;
      void runSignInIfNeeded(connectedAddress);
    },
  });

  useEffect(() => {
    if (!ready || authMethod === 'bankr') return;
    if (!isConnected || !address) return;
    if (session?.walletAddress?.toLowerCase() === address.toLowerCase()) return;
    void runSignInIfNeeded(address);
  }, [ready, authMethod, isConnected, address, session?.walletAddress, runSignInIfNeeded]);

  const connectWallet = useCallback(() => {
    setAuthError(null);

    if (status === 'connecting' || status === 'reconnecting') {
      setAuthError('Connecting wallet… check your extension.');
      return;
    }

    if (isConnected && address) {
      if (session?.walletAddress?.toLowerCase() === address.toLowerCase()) {
        setAuthError('Already signed in.');
        return;
      }
      void runSignInIfNeeded(address);
      setAuthError('Approve the sign-in message in your wallet. Tap Connect again if you do not see it.');
      return;
    }

    if (openConnectModal) {
      openConnectModal();
      return;
    }

    setAuthError('Wallet connect is loading… try again in a moment.');
  }, [
    openConnectModal,
    status,
    isConnected,
    address,
    session?.walletAddress,
    runSignInIfNeeded,
  ]);

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
    signInFlightRef.current = null;
    clearStoredSession();
    setSession(null);
    sessionRef.current = null;
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
