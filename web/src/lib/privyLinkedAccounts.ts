import type { User } from '@privy-io/react-auth';

/** Linked X/Twitter @handle from Privy user, if any. */
export function twitterUsernameFromPrivyUser(user: User | null | undefined): string | undefined {
  if (!user?.linkedAccounts?.length) return undefined;
  for (const a of user.linkedAccounts) {
    const typ = String(a.type ?? '').toLowerCase();
    if (!typ.includes('twitter') && !typ.includes('x_oauth') && typ !== 'x') continue;
    const raw =
      ('username' in a && typeof a.username === 'string' ? a.username : undefined) ??
      ('name' in a && typeof a.name === 'string' ? a.name : undefined);
    const t = raw?.trim().replace(/^@/, '');
    if (t) return t.toLowerCase();
  }
  return undefined;
}

export function hasTwitterLinked(user: User | null | undefined): boolean {
  return !!twitterUsernameFromPrivyUser(user);
}
