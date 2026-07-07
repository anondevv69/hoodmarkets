import type { CommunityLaunchLockConflict } from '../api';
import { openCommunityLaunchPage } from '../lib/communityLaunchRoute';

function noticeCopy(conflict: CommunityLaunchLockConflict): { title: string; body: string } {
  if (conflict.kind === 'ticker') {
    return {
      title: `$${conflict.tokenSymbol} is on Community Launch`,
      body: `A community round is raising ETH for $${conflict.tokenSymbol} (${conflict.tokenName}). Back it to get pro-rata Holder NFT shares and help seed the initial LP — instant deploy is paused until the round finishes or expires.`,
    };
  }
  return {
    title: `"${conflict.tokenName}" is on Community Launch`,
    body: `That name is tied to an active Community Launch for $${conflict.tokenSymbol}. Join the round instead of launching a duplicate — instant deploy is paused until the round ends.`,
  };
}

export function CommunityLaunchRedirectNotice({
  conflict,
  onNavigate,
}: {
  conflict: CommunityLaunchLockConflict;
  onNavigate?: () => void;
}) {
  const { title, body } = noticeCopy(conflict);

  const go = () => {
    openCommunityLaunchPage(conflict.roundId);
    onNavigate?.();
  };

  return (
    <div className="community-launch-redirect lp-fade-in" role="alert">
      <p className="community-launch-redirect-title">{title}</p>
      <p className="community-launch-redirect-body muted">{body}</p>
      <button type="button" className="btn btn-primary" onClick={go}>
        Join Community Launch →
      </button>
    </div>
  );
}

export function redirectToCommunityLaunch(conflict: CommunityLaunchLockConflict): void {
  openCommunityLaunchPage(conflict.roundId);
}
