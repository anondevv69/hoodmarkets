import { useEffect, useState } from 'react';
import { fetchTokenVesting, type TokenVestingGrant } from '../api';

function GrantCard({ grant }: { grant: TokenVestingGrant }) {
  const pct = Math.min(100, Math.max(0, grant.progressPct));

  return (
    <article className="token-vesting-card">
      <div className="token-vesting-card-head">
        <div>
          <a
            className="token-vesting-repo"
            href={grant.githubUrl}
            target="_blank"
            rel="noreferrer"
          >
            {grant.repoFullName}
          </a>
          <p className="token-vesting-meta muted">
            <a href={grant.devUrl} target="_blank" rel="noreferrer">
              @{grant.githubOwner}
            </a>
            {' · '}
            {grant.totalLockedFormatted} locked
            {grant.streaming ? ' · streaming' : ''}
          </p>
        </div>
        <span className={`token-vesting-status token-vesting-status--${grant.status}`}>
          {grant.status}
        </span>
      </div>

      <div className="token-vesting-bar" aria-hidden>
        <div className="token-vesting-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <p className="token-vesting-progress muted">
        {grant.progress.verifiedPushCount} / {grant.progress.totalPushesRequired} verified pushes
        {' · '}
        {pct}%
      </p>

      {grant.progress.summary ? (
        <p className="token-vesting-summary muted">{grant.progress.summary}</p>
      ) : null}

      <div className="token-vesting-links">
        <a href={grant.lockUrl} target="_blank" rel="noreferrer" className="token-vesting-link">
          View lock on Proof of Dev →
        </a>
      </div>
    </article>
  );
}

export function VestingTabPanel({
  tokenAddress,
  feeRecipientAddress,
}: {
  tokenAddress: string;
  feeRecipientAddress?: string | null;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchTokenVesting>>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const row = await fetchTokenVesting(tokenAddress, feeRecipientAddress);
        if (!cancelled) setData(row);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenAddress, feeRecipientAddress]);

  if (loading) {
    return (
      <section className="tp-zone tp-vesting-zone" aria-labelledby="vesting-heading">
        <p id="vesting-heading" className="tp-zone-label">
          GitHub vesting
        </p>
        <p className="muted token-vesting-note">Loading Proof of Dev locks…</p>
      </section>
    );
  }

  const grants = data?.grants ?? [];
  const createUrl = data?.createLockUrl ?? `https://www.proofofdev.xyz/create?token=${tokenAddress}`;

  return (
    <section className="tp-zone tp-vesting-zone" aria-labelledby="vesting-heading">
      <div className="token-vesting-head">
        <p id="vesting-heading" className="tp-zone-label">
          GitHub vesting
        </p>
        <p className="token-vesting-sub muted">
          Proof of Dev — lock tokens, earn them back by shipping verified GitHub pushes
        </p>
      </div>

      {grants.length === 0 ? (
        <div className="token-vesting-empty">
          <p className="muted">
            No active GitHub vesting locks for this token yet.
            {feeRecipientAddress
              ? ' Locks tied to the fee recipient wallet on Base are shown here when registered.'
              : null}
          </p>
          <a
            href={createUrl}
            target="_blank"
            rel="noreferrer"
            className="token-vesting-cta"
          >
            Create lock on Proof of Dev →
          </a>
        </div>
      ) : (
        <>
          <p className="token-vesting-summary-line muted">
            {data?.activeCount ?? 0} active lock{(data?.activeCount ?? 0) === 1 ? '' : 's'} across{' '}
            {data?.uniqueDevs ?? 0} developer{(data?.uniqueDevs ?? 0) === 1 ? '' : 's'}
            {(data?.sources?.byRecipient ?? 0) > 0 && (data?.sources?.byToken ?? 0) === 0
              ? ' (matched via fee recipient wallet)'
              : null}
          </p>
          <div className="token-vesting-list">
            {grants.map((grant) => (
              <GrantCard key={grant.repoFullName} grant={grant} />
            ))}
          </div>
          <a
            href={data?.exploreUrl ?? 'https://www.proofofdev.xyz'}
            target="_blank"
            rel="noreferrer"
            className="token-vesting-explore muted"
          >
            Explore all locks on Proof of Dev →
          </a>
        </>
      )}
    </section>
  );
}
