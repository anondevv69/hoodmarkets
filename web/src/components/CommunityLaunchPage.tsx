import { useEffect, useState } from 'react';
import { useWebAuth } from '../auth/WebAuthContext';
import { useActiveWallet } from '../hooks/useActiveWallet';
import {
  createCommunityLaunch,
  fetchCommunityLaunchConfig,
  fetchCommunityLaunchList,
  fetchCommunityLaunchStatus,
  prepareCommunityLaunchDeposit,
  confirmCommunityLaunchDeposit,
  type CommunityLaunchSummary,
} from '../api';
import {
  closeCommunityLaunchPage,
  openCommunityLaunchPage,
  readCommunityLaunchIdFromUrl,
  redirectLegacyPetitionPath,
} from '../lib/communityLaunchRoute';
import { openTokenPage } from '../lib/tokenRoute';
import { shortenAddress } from '../chain';

function RaiseProgressBar({
  raisedEth,
  targetRaiseEth,
  pct,
}: {
  raisedEth: string;
  targetRaiseEth: string;
  pct: number;
}) {
  return (
    <div className="petition-progress">
      <div className="petition-progress-fill" style={{ width: `${pct}%` }} />
      <span className="petition-progress-label">
        {raisedEth} / {targetRaiseEth} ETH raised
      </span>
    </div>
  );
}

function PetitionCard({
  petition,
  onOpen,
}: {
  petition: CommunityLaunchSummary;
  onOpen: (id: string) => void;
}) {
  return (
    <button type="button" className="petition-card lp-card" onClick={() => onOpen(petition.id)}>
      <div className="petition-card-head">
        <strong>${petition.tokenSymbol}</strong>
        <span className="muted">{petition.tokenName}</span>
      </div>
      <RaiseProgressBar
        raisedEth={petition.raisedEth}
        targetRaiseEth={petition.targetRaiseEth}
        pct={petition.raiseProgressPct}
      />
      <p className="petition-card-meta muted">
        {petition.status} · {petition.remainingEth} ETH left · 1,000 Holder NFT shares pro-rata
      </p>
    </button>
  );
}

function CreatePetitionForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { walletAddress } = useWebAuth();
  const wallet = useActiveWallet();
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [targetRaiseEth, setTargetRaiseEth] = useState('5');
  const [supporterSlots, setSupporterSlots] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creatorWallet = wallet?.address ?? walletAddress ?? undefined;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await createCommunityLaunch({
        tokenName: tokenName.trim(),
        tokenSymbol: tokenSymbol.trim().replace(/^\$/, ''),
        description: description.trim() || undefined,
        starterWallet: creatorWallet,
        targetRaiseEth: targetRaiseEth.trim(),
        supporterSlots: supporterSlots ? Number.parseInt(supporterSlots, 10) : undefined,
      });
      onCreated(res.petition.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create community launch');
    } finally {
      setLoading(false);
    }
  };

  const slotHint =
    supporterSlots && targetRaiseEth
      ? (() => {
          const slots = Number.parseInt(supporterSlots, 10);
          const total = Number.parseFloat(targetRaiseEth);
          if (slots > 0 && total > 0) return `${(total / slots).toFixed(4)} ETH per slot`;
          return null;
        })()
      : null;

  return (
    <form className="petition-form lp-card" onSubmit={onSubmit}>
      <h2 className="petition-section-title">Start a community launch</h2>
      <p className="muted petition-lead">
        Set an ETH raise goal (e.g. 5 ETH). When the goal is met, hood.markets deploys the token
        with that ETH as the initial LP buy. Backers receive Holder NFT shares proportional to how
        much they contributed — shares earn trading fees and can be redeemed for vault tokens.
      </p>
      <label className="field-label">
        Token name
        <input value={tokenName} onChange={(e) => setTokenName(e.target.value)} required minLength={2} />
      </label>
      <label className="field-label">
        Ticker
        <input
          value={tokenSymbol}
          onChange={(e) => setTokenSymbol(e.target.value)}
          required
          maxLength={10}
          placeholder="SYM"
        />
      </label>
      <label className="field-label">
        Raise goal (ETH) — becomes initial LP buy
        <input
          value={targetRaiseEth}
          onChange={(e) => setTargetRaiseEth(e.target.value)}
          required
          inputMode="decimal"
          placeholder="5"
        />
      </label>
      <label className="field-label">
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </label>
      <label className="field-label">
        Supporter slots (optional)
        <input
          type="number"
          min={2}
          max={500}
          value={supporterSlots}
          onChange={(e) => setSupporterSlots(e.target.value)}
          placeholder="e.g. 20 → equal ETH slots"
        />
      </label>
      {slotHint ? <p className="muted petition-slot-hint">{slotHint}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Creating…' : 'Create community launch'}
      </button>
    </form>
  );
}

function PetitionDetail({ id }: { id: string }) {
  const { connectWallet } = useWebAuth();
  const wallet = useActiveWallet();
  const [petition, setPetition] = useState<CommunityLaunchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [contributionEth, setContributionEth] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const walletAddress = wallet?.address;

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetchCommunityLaunchStatus(id);
      setPetition(res.petition);
      if (res.petition.contributionPerSlotEth && !contributionEth) {
        setContributionEth(res.petition.contributionPerSlotEth);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load petition');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 15000);
    return () => clearInterval(t);
  }, [id]);

  const onDeposit = async () => {
    if (!wallet || !walletAddress) {
      connectWallet();
      return;
    }
    const amount = contributionEth.trim();
    if (!amount) {
      setError('Enter an ETH contribution amount.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const prep = await prepareCommunityLaunchDeposit({
        id,
        wallet: walletAddress,
        contributionEth: amount,
      });
      const provider = (await wallet.getEthereumProvider()) as {
        request: (args: { method: string; params: unknown[] }) => Promise<string>;
      };
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: walletAddress,
            to: prep.nextStep.to,
            value: `0x${BigInt(prep.nextStep.value).toString(16)}`,
            data: prep.nextStep.data,
          },
        ],
      });
      await confirmCommunityLaunchDeposit({
        id,
        wallet: walletAddress,
        contributionEth: amount,
        signature: String(txHash),
      });
      setMessage(`Contributed ${prep.deposit.totalEth} ETH toward the launch.`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deposit failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !petition) return <p className="muted">Loading community launch…</p>;
  if (!petition) return <p className="error">{error ?? 'Community launch not found'}</p>;

  const canDeposit = petition.status === 'open';
  const estimatedPct =
    contributionEth && petition.targetRaiseEth
      ? Math.min(
          100,
          (Number.parseFloat(contributionEth) / Number.parseFloat(petition.targetRaiseEth)) * 100,
        )
      : 0;
  const estimatedShares = Math.round((estimatedPct / 100) * 1000);

  return (
    <div className="petition-detail">
      <button type="button" className="btn btn-ghost" onClick={() => openCommunityLaunchPage()}>
        ← All launches
      </button>
      <div className="lp-card petition-detail-card">
        <h1 className="lp-display petition-detail-title">
          ${petition.tokenSymbol}{' '}
          <span className="muted petition-detail-name">{petition.tokenName}</span>
        </h1>
        {petition.description ? <p className="petition-lead">{petition.description}</p> : null}
        <RaiseProgressBar
          raisedEth={petition.raisedEth}
          targetRaiseEth={petition.targetRaiseEth}
          pct={petition.raiseProgressPct}
        />
        <p className="muted petition-raise-note">
          All raised ETH seeds the initial Uniswap LP at deploy. Holder NFT shares (1,000 total) are
          airdropped pro-rata by contribution — holders earn swap fees and can redeem shares for
          vault tokens.
        </p>
        <dl className="petition-stats">
          <div>
            <dt>Status</dt>
            <dd>{petition.status}</dd>
          </div>
          <div>
            <dt>Initial LP buy</dt>
            <dd>{petition.targetRaiseEth} ETH at goal</dd>
          </div>
          <div>
            <dt>Expires</dt>
            <dd>{new Date(petition.expiresAt).toLocaleString()}</dd>
          </div>
          {petition.contributionPerSlotEth ? (
            <div>
              <dt>Per slot</dt>
              <dd>{petition.contributionPerSlotEth} ETH</dd>
            </div>
          ) : null}
          {petition.escrowWallet ? (
            <div>
              <dt>Escrow</dt>
              <dd className="lp-mono">{shortenAddress(petition.escrowWallet)}</dd>
            </div>
          ) : null}
        </dl>

        {petition.finalResult?.tokenAddress ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openTokenPage(petition.finalResult!.tokenAddress!)}
          >
            View live token
          </button>
        ) : null}

        {canDeposit ? (
          <div className="petition-back-block">
            <h2 className="petition-section-title">Back this launch</h2>
            <label className="field-label">
              Your contribution (ETH)
              <input
                value={contributionEth}
                onChange={(e) => setContributionEth(e.target.value)}
                inputMode="decimal"
                placeholder={petition.contributionPerSlotEth ?? '0.1'}
                readOnly={Boolean(petition.contributionPerSlotEth)}
              />
            </label>
            {contributionEth ? (
              <p className="muted petition-estimate">
                ~{estimatedShares} / 1,000 shares ({estimatedPct.toFixed(2)}% of raise at goal)
              </p>
            ) : null}
            {error ? <p className="error">{error}</p> : null}
            {message ? <p className="muted">{message}</p> : null}
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onDeposit}>
              {busy ? 'Sending…' : wallet ? 'Send ETH contribution' : 'Connect wallet to back'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CommunityLaunchPage() {
  redirectLegacyPetitionPath();
  const [petitions, setPetitions] = useState<CommunityLaunchSummary[]>([]);
  const [configOk, setConfigOk] = useState<boolean | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'detail'>(() =>
    readCommunityLaunchIdFromUrl() ? 'detail' : 'list',
  );
  const [detailId, setDetailId] = useState<string | null>(readCommunityLaunchIdFromUrl());

  useEffect(() => {
    const sync = () => {
      redirectLegacyPetitionPath();
      const id = readCommunityLaunchIdFromUrl();
      setDetailId(id);
      setView(
        id
          ? 'detail'
          : window.location.search.includes('create')
            ? 'create'
            : 'list',
      );
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    void fetchCommunityLaunchConfig()
      .then((c) => setConfigOk(c.config.enabled))
      .catch(() => setConfigOk(false));
    void fetchCommunityLaunchList()
      .then((r) => setPetitions(r.petitions))
      .catch(() => setPetitions([]));
  }, []);

  if (configOk === false) {
    return (
      <p className="error">
        Community Launch is not configured yet. api.hood.markets + Robinhood Chain escrow required.
      </p>
    );
  }

  if (view === 'detail' && detailId) {
    return <PetitionDetail id={detailId} />;
  }

  return (
    <div className="petition-page">
      <div className="petition-page-head">
        <div>
          <h1 className="lp-display page-title">Community Launch</h1>
          <p className="page-sub">
            Raise ETH together on Robinhood Chain — goal met → deploy with that ETH as initial LP →
            pro-rata Holder NFT shares for every backer.
          </p>
        </div>
        <div className="petition-page-actions">
          <button type="button" className="btn btn-ghost" onClick={closeCommunityLaunchPage}>
            ← Explore
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setView('create');
              openCommunityLaunchPage();
              const url = new URL(window.location.href);
              url.searchParams.set('create', '1');
              window.history.replaceState({}, '', url.toString());
            }}
          >
            Start community launch
          </button>
        </div>
      </div>

      {view === 'create' ? (
        <CreatePetitionForm
          onCreated={(id) => {
            openCommunityLaunchPage(id);
            setDetailId(id);
            setView('detail');
          }}
        />
      ) : null}

      <section className="petition-catalog">
        <h2 className="petition-section-title">Open community launches</h2>
        {petitions.length === 0 ? (
          <p className="muted">No open launches yet. Start the first one on hood.markets.</p>
        ) : (
          <div className="petition-grid">
            {petitions.map((p) => (
              <PetitionCard
                key={p.id}
                petition={p}
                onOpen={(id) => {
                  openCommunityLaunchPage(id);
                  setDetailId(id);
                  setView('detail');
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
