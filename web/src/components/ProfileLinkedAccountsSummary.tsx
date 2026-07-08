import { shortenAddress } from '../chain';
import { xProfileUrl } from '../lib/requesterXDisplay';
import { openWalletProfile } from '../lib/deployerProfileRoute';

export type LinkedAccountsSummary = {
  xHandle: string | null;
  xLinked: boolean;
  bankrWallet: string | null;
  bankrLinked: boolean;
  bankrVerified?: boolean;
  telegramLinked?: boolean;
  telegramStatus?: 'coming_soon';
};

function StatusBadge({
  kind,
  label,
}: {
  kind: 'linked' | 'verified' | 'muted' | 'soon';
  label: string;
}) {
  return (
    <span className={`profile-link-badge profile-link-badge--${kind}`}>{label}</span>
  );
}

export function ProfileLinkedAccountsSummary({
  accounts,
}: {
  accounts: LinkedAccountsSummary;
}) {
  const xHandle = accounts.xHandle?.replace(/^@/, '') ?? null;

  return (
    <div className="profile-linked-summary">
      <p className="section-label">Linked accounts</p>
      <dl className="profile-linked-summary-list">
        <div className="profile-linked-summary-row">
          <dt>X</dt>
          <dd>
            {accounts.xLinked && xHandle ? (
              <>
                <a href={xProfileUrl(xHandle)} target="_blank" rel="noreferrer" className="lp-mono">
                  @{xHandle}
                </a>
                <StatusBadge kind="linked" label="Linked" />
              </>
            ) : (
              <>
                <span className="muted">Not linked</span>
                <StatusBadge kind="muted" label="Optional" />
              </>
            )}
          </dd>
        </div>
        <div className="profile-linked-summary-row">
          <dt>Bankr</dt>
          <dd>
            {accounts.bankrLinked && accounts.bankrWallet ? (
              <>
                <button
                  type="button"
                  className="profile-linked-wallet-btn lp-mono"
                  onClick={() => openWalletProfile(accounts.bankrWallet!)}
                >
                  {shortenAddress(accounts.bankrWallet)}
                </button>
                <StatusBadge
                  kind={accounts.bankrVerified === false ? 'linked' : 'verified'}
                  label={accounts.bankrVerified === false ? 'Linked' : 'Verified'}
                />
              </>
            ) : (
              <>
                <span className="muted">Not linked</span>
                <StatusBadge kind="muted" label="Optional" />
              </>
            )}
          </dd>
        </div>
        <div className="profile-linked-summary-row">
          <dt>Telegram</dt>
          <dd>
            <span className="muted">App login coming soon</span>
            <StatusBadge kind="soon" label="Soon" />
          </dd>
        </div>
      </dl>
      <p className="muted token-fee-note">
        Bankr links are wallet-verified. X and Telegram will use official app login when available.
      </p>
    </div>
  );
}
