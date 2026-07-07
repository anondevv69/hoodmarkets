const STORAGE_KEY = 'hoodmarkets_web_session_v1';

export type StoredWebSession = {
  token: string;
  walletAddress: string;
  walletKind: string;
  expiresAt: string;
};

export function readStoredSession(): StoredWebSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWebSession;
    if (!parsed.token || !parsed.walletAddress) return null;
    if (parsed.expiresAt && Date.parse(parsed.expiresAt) < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredWebSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
