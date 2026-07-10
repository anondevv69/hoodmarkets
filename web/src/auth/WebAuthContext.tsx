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
import { useAccount, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
  type StoredWebSession,
} from './session';
import { fetchWalletLoginChallenge, verifyWalletLogin } from './walletAuthApi';
import {
  isWalletUserRejection,
  signWalletMessageNow,
  waitForWalletReady,
} from './signWalletLoginMessage';

export type WebAuthMethod = 'rainbow' | null;

type WebAuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  signingIn: boolean;
  walletAddress: string | null;
  walletKind: string | null;
  authMethod: WebAuthMethod;
  getAccessToken: () => Promise<string | null>;
  connectWallet: () => void;
  logout: () => void;
  authError: string | null;
  clearAuthError: () => void;
};

const WebAuthContext = createContext<WebAuthContextValue | null>(null);

function isUserRejection(error: unknown): boolean {
  return isWalletUserRejection(error);
}

function isTransientSignInError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /connector not connected|unavailable while reconnecting|connection timed out|connector not ready/i.test(
    msg,
  );
}

function isChallengeError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /challenge expired|challenge not found|already used|invalid login message/i.test(msg);
}

export function WebAuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, status } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const [session, setSession] = useState<StoredWebSession | null>(null);
  const [authMethod, setAuthMethod] = useState<WebAuthMethod>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const signInFlightRef = useRef<string | null>(null);
  const signInPromiseRef = useRef<Promise<void> | null>(null);
  const sessionRef = useRef<StoredWebSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const stored = readStoredSession();
    // Site login is wallet-only. Drop legacy Bankr API-key sessions.
    if (stored?.walletKind === 'bankr-evm') {
      clearStoredSession();
      setSession(null);
      sessionRef.current = null;
      setAuthMethod(null);
    } else if (stored?.token) {
      setSession(stored);
      sessionRef.current = stored;
      setAuthMethod('rainbow');
    }
    setReady(true);
  }, []);

  const completeWalletLogin = useCallback(async (walletAddress: string, walletKind: string) => {
    await waitForWalletReady(walletAddress);

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const challenge = await fetchWalletLoginChallenge(walletAddress);
      try {
        const signature = await signWalletMessageNow(walletAddress, challenge.message);
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
        setAuthMethod('rainbow');
        setAuthError(null);
        return;
      } catch (error) {
        lastError = error;
        if (isWalletUserRejection(error)) throw error;
        if (attempt === 0 && isChallengeError(error)) continue;
        throw error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Wallet sign-in failed.');
  }, []);

  const runSignInIfNeeded = useCallback(
    async (walletAddress: string) => {
      const key = walletAddress.toLowerCase();
      const stored = sessionRef.current ?? readStoredSession();
      if (stored?.walletKind === 'bankr-evm') {
        clearStoredSession();
        setSession(null);
        sessionRef.current = null;
        setAuthMethod(null);
      } else if (stored?.walletAddress?.toLowerCase() === key) {
        if (!sessionRef.current) {
          setSession(stored);
          sessionRef.current = stored;
          setAuthMethod('rainbow');
        }
        return;
      }
      if (signInPromiseRef.current) {
        await signInPromiseRef.current.catch(() => undefined);
        const afterWait = sessionRef.current ?? readStoredSession();
        if (afterWait?.walletAddress?.toLowerCase() === key) return;
      }
      if (signInFlightRef.current === key) return;

      signInFlightRef.current = key;
      setSigningIn(true);
      setAuthError(null);

      const signInPromise = (async () => {
        try {
          await completeWalletLogin(walletAddress, 'injected');
        } catch (e) {
          if (signInFlightRef.current !== key) return;
          if (isUserRejection(e)) {
            setAuthError('Sign-in cancelled in wallet. Click Connect wallet to try again.');
          } else {
            const msg = e instanceof Error ? e.message : 'Wallet sign-in failed.';
            setAuthError(msg);
            if (!isChallengeError(e) && !isTransientSignInError(e)) {
              disconnect();
              clearStoredSession();
              setSession(null);
              sessionRef.current = null;
              setAuthMethod(null);
            }
          }
        } finally {
          if (signInFlightRef.current === key) {
            signInFlightRef.current = null;
            setSigningIn(false);
          }
        }
      })();

      signInPromiseRef.current = signInPromise;
      try {
        await signInPromise;
      } finally {
        if (signInPromiseRef.current === signInPromise) {
          signInPromiseRef.current = null;
        }
      }
    },
    [completeWalletLogin, disconnect],
  );

  useEffect(() => {
    if (!ready) return;
    if (status !== 'connected' || !address) return;
    if (session?.walletAddress?.toLowerCase() === address.toLowerCase()) return;
    void runSignInIfNeeded(address);
  }, [ready, status, address, session?.walletAddress, runSignInIfNeeded]);

  const connectWallet = useCallback(() => {
    setAuthError(null);

    if (status === 'connecting' || status === 'reconnecting') {
      setAuthError('Connecting wallet… check your extension for prompts.');
      return;
    }

    if (signingIn || signInFlightRef.current) {
      setAuthError('Check your wallet — approve the hood.markets sign-in message.');
      return;
    }

    if (status === 'connected' && address) {
      if (session?.walletAddress?.toLowerCase() === address.toLowerCase()) {
        return;
      }
      void runSignInIfNeeded(address);
      setAuthError('Check your wallet — approve the sign-in message.');
      return;
    }

    if (openConnectModal) {
      openConnectModal();
      return;
    }

    setAuthError('Wallet connect is loading… refresh if this persists.');
  }, [openConnectModal, status, address, signingIn, session?.walletAddress, runSignInIfNeeded]);

  const logout = useCallback(() => {
    signInFlightRef.current = null;
    signInPromiseRef.current = null;
    setSigningIn(false);
    clearStoredSession();
    setSession(null);
    sessionRef.current = null;
    setAuthMethod(null);
    setAuthError(null);
    if (isConnected) disconnect();
  }, [disconnect, isConnected]);

  const getAccessToken = useCallback(async () => {
    const s = session ?? readStoredSession();
    if (s?.walletKind === 'bankr-evm') return null;
    return s?.token ?? null;
  }, [session]);

  const value = useMemo<WebAuthContextValue>(
    () => ({
      ready,
      authenticated: !!session?.token && session.walletKind !== 'bankr-evm',
      signingIn,
      walletAddress: session?.walletKind === 'bankr-evm' ? null : (session?.walletAddress ?? null),
      walletKind: session?.walletKind === 'bankr-evm' ? null : (session?.walletKind ?? null),
      authMethod,
      getAccessToken,
      connectWallet,
      logout,
      authError,
      clearAuthError: () => setAuthError(null),
    }),
    [ready, session, signingIn, authMethod, getAccessToken, connectWallet, logout, authError],
  );

  return <WebAuthContext.Provider value={value}>{children}</WebAuthContext.Provider>;
}

export function useWebAuth(): WebAuthContextValue {
  const ctx = useContext(WebAuthContext);
  if (!ctx) throw new Error('useWebAuth must be used within WebAuthProvider');
  return ctx;
}
