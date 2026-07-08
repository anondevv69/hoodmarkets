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
import { useAccount, useAccountEffect, useDisconnect } from 'wagmi';
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
import { isWalletUserRejection, signWalletLoginMessage } from './signWalletLoginMessage';

export type WebAuthMethod = 'rainbow' | 'bankr' | null;

type WebAuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  signingIn: boolean;
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

function isUserRejection(error: unknown): boolean {
  return isWalletUserRejection(error);
}

function isTransientSignInError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /connector not connected|unavailable while reconnecting|connection timed out|connector not ready/i.test(
    msg,
  );
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
      const stored = sessionRef.current ?? readStoredSession();
      if (stored?.walletAddress?.toLowerCase() === key) {
        if (!sessionRef.current) {
          setSession(stored);
          sessionRef.current = stored;
          setAuthMethod(stored.walletKind === 'bankr-evm' ? 'bankr' : 'rainbow');
        }
        return;
      }
      if (signInFlightRef.current === key) return;

      signInFlightRef.current = key;
      setSigningIn(true);
      setAuthError(null);
      try {
        await completeWalletLogin(
          walletAddress,
          (message) => signWalletLoginMessage(walletAddress, message),
          'injected',
        );
      } catch (e) {
        if (signInFlightRef.current !== key) return;
        if (isUserRejection(e)) {
          setAuthError('Sign-in cancelled in wallet. Click Connect wallet to try again.');
        } else {
          const msg = e instanceof Error ? e.message : 'Wallet sign-in failed.';
          setAuthError(msg);
          if (!/challenge expired/i.test(msg) && !isTransientSignInError(e)) {
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
    },
    [completeWalletLogin, disconnect],
  );

  useAccountEffect({
    onConnect({ address: connectedAddress }) {
      if (!ready || !connectedAddress) return;
      void runSignInIfNeeded(connectedAddress);
    },
  });

  useEffect(() => {
    if (!ready || authMethod === 'bankr') return;
    if (status !== 'connected' || !address) return;
    if (session?.walletAddress?.toLowerCase() === address.toLowerCase()) return;
    void runSignInIfNeeded(address);
  }, [ready, authMethod, status, address, session?.walletAddress, runSignInIfNeeded]);

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
  }, [
    openConnectModal,
    status,
    address,
    signingIn,
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
    return s?.token ?? null;
  }, [session]);

  const value = useMemo<WebAuthContextValue>(
    () => ({
      ready,
      authenticated: !!session?.token,
      signingIn,
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
      signingIn,
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
