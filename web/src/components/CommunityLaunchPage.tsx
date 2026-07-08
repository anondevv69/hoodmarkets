import { useEffect, useRef, useState } from 'react';
import { createWalletClient, custom, getAddress, type Address } from 'viem';
import { useWebAuth } from '../auth/WebAuthContext';
import { useActiveWallet } from '../hooks/useActiveWallet';
import {
  createCommunityLaunch,
  fetchCommunityLaunchConfig,
  fetchCommunityLaunchList,
  fetchCommunityLaunchStatus,
  prepareCommunityLaunchDeposit,
  confirmCommunityLaunchDeposit,
  refundCommunityLaunch,
  cancelCommunityLaunch,
  type CommunityLaunchSummary,
} from '../api';
import { readImageFileAsDataUrl, resolveLaunchImagePayload } from '../lib/imageUpload';
import {
  closeCommunityLaunchPage,
  migrateCommunityLaunchPath,
  openCommunityLaunchPage,
  readCommunityLaunchCreateFromUrl,
  readCommunityLaunchIdFromUrl,
  redirectLegacyPetitionPath,
  setLaunchSubMode,
} from '../lib/communityLaunchRoute';
import { ensureRobinhoodChainInWallet } from '../lib/ensureRobinhoodChain';
import { openTokenPage } from '../lib/tokenRoute';
import { robinhood, shortenAddress } from '../chain';
import { TokenAvatar } from './TokenAvatar';

function walletsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

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
        <TokenAvatar symbol={petition.tokenSymbol} imageUrl={petition.imageUrl} size={32} />
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
  const [imageUrl, setImageUrl] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [targetRaiseEth, setTargetRaiseEth] = useState('5');
  const [supporterSlots, setSupporterSlots] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creatorWallet = wallet?.address ?? walletAddress ?? undefined;

  async function onPickLogo(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setImageDataUrl(dataUrl);
      setImageFileName(file.name);
      setImageUrl('');
    } catch (e) {
      setImageDataUrl(null);
      setImageFileName('');
      setError(e instanceof Error ? e.message : 'Could not read logo');
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resolvedImage = resolveLaunchImagePayload(imageDataUrl, imageUrl);
      const res = await createCommunityLaunch({
        tokenName: tokenName.trim(),
        tokenSymbol: tokenSymbol.trim().replace(/^\$/, ''),
        description: description.trim() || undefined,
        imageUrl: resolvedImage,
        websiteUrl: websiteUrl.trim() || undefined,
        xUrl: xUrl.trim() || undefined,
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

  const previewSymbol = (tokenSymbol.trim() || 'TKN').toUpperCase();
  const previewImage = resolveLaunchImagePayload(imageDataUrl, imageUrl);

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
        <input className="lp-input" value={tokenName} onChange={(e) => setTokenName(e.target.value)} required minLength={2} />
      </label>
      <label className="field-label">
        Ticker
        <input
          className="lp-input"
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
          className="lp-input"
          value={targetRaiseEth}
          onChange={(e) => setTargetRaiseEth(e.target.value)}
          required
          inputMode="decimal"
          placeholder="5"
        />
      </label>
      <div className="field-label">
        Logo
        <div className="logo-upload-row">
          <button
            type="button"
            className="logo-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            {imageFileName || imageDataUrl ? 'Change logo' : 'Upload logo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onPickLogo(e.target.files?.[0] ?? null)}
          />
          <span className="muted logo-upload-hint">
            {imageFileName ? imageFileName : 'PNG, JPG, GIF, or WebP · max 2 MB'}
          </span>
        </div>
        <input
          className="lp-input"
          value={imageUrl}
          onChange={(e) => {
            setImageUrl(e.target.value);
            if (e.target.value.trim()) {
              setImageDataUrl(null);
              setImageFileName('');
            }
          }}
          placeholder="Or paste image URL (https://…)"
          type="url"
          disabled={!!imageDataUrl}
          style={{ marginTop: '0.5rem' }}
        />
        {previewImage ? (
          <div className="community-launch-logo-preview" style={{ marginTop: '0.75rem' }}>
            <TokenAvatar symbol={previewSymbol} imageUrl={previewImage} size={64} priority />
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              Logo preview
            </span>
          </div>
        ) : null}
      </div>
      <label className="field-label">
        Description
        <textarea className="lp-input" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </label>
      <div className="name-symbol-row">
        <label className="field-label">
          Website
          <input
            className="lp-input"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourproject.com"
            type="url"
          />
        </label>
        <label className="field-label">
          X
          <input
            className="lp-input"
            value={xUrl}
            onChange={(e) => setXUrl(e.target.value)}
            placeholder="@handle or https://x.com/…"
          />
        </label>
      </div>
      <label className="field-label">
        Supporter slots (optional)
        <input
          className="lp-input"
          type="number"
          min={2}
          max={500}
          value={supporterSlots}
          onChange={(e) => setSupporterSlots(e.target.value)}
          placeholder="e.g. 20"
        />
      </label>
      <div className="petition-field-help muted" role="note">
        <p>
          <strong>Leave blank</strong> for a flexible raise: anyone can back any amount up to what&apos;s
          left on the goal. Shares are split <strong>pro-rata</strong> by ETH contributed — a 2 ETH
          backer earns more Holder NFT shares than a 0.1 ETH backer; there are no fixed seats.
        </p>
        <p>
          <strong>Set a number</strong> to split the goal into equal fixed slots — each backer must
          send exactly goal ÷ slots ETH, and only that many backers can join. Examples: 5 ETH ÷ 20
          slots = 0.25 ETH each; 1 ETH ÷ 10 = 0.1 ETH each (goal must divide evenly).
        </p>
        {slotHint ? <p className="petition-slot-hint">{slotHint} with your current goal.</p> : null}
      </div>
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
  const [action, setAction] = useState<'deposit' | 'refund' | 'cancel' | null>(null);
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
    setAction('deposit');
    setError(null);
    setMessage(null);
    try {
      const prep = await prepareCommunityLaunchDeposit({
        id,
        wallet: walletAddress,
        contributionEth: amount,
      });
      const provider = await wallet.getEthereumProvider();
      await ensureRobinhoodChainInWallet(
        provider as Parameters<typeof ensureRobinhoodChainInWallet>[0],
      );
      const account = getAddress(walletAddress) as Address;
      const client = createWalletClient({
        account,
        chain: robinhood,
        transport: custom(provider as Parameters<typeof custom>[0]),
      });
      const txHash = await client.sendTransaction({
        account,
        chain: robinhood,
        to: getAddress(prep.nextStep.to),
        value: BigInt(prep.nextStep.value),
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
      const msg = e instanceof Error ? e.message : 'Deposit failed';
      if (/reject|denied|cancel|declined/i.test(msg)) {
        setError('Transaction cancelled in wallet.');
      } else if (/insufficient|funds|balance/i.test(msg)) {
        setError(
          `${msg} You need enough ETH on Robinhood Chain for the contribution plus network fee.`,
        );
      } else if (/unavailable|estimate|gas/i.test(msg)) {
        setError(
          'MetaMask could not estimate the network fee. Ensure Robinhood Chain is selected, you have extra ETH for gas, then try again.',
        );
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  const onRefund = async () => {
    if (!walletAddress) {
      connectWallet();
      return;
    }
    if (
      !window.confirm(
        'Request a full refund of your ETH contribution? This cannot be undone.',
      )
    ) {
      return;
    }
    setBusy(true);
    setAction('refund');
    setError(null);
    setMessage(null);
    try {
      const order = petition?.orders?.find(
        (o) => walletsMatch(o.wallet, walletAddress) && o.status === 'active',
      );
      const res = await refundCommunityLaunch({ id, wallet: walletAddress });
      setMessage(`Refunded ${order?.contributionEth ?? ''} ETH to your wallet.`);
      setPetition(res.petition);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refund failed');
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  const onCancelLaunch = async () => {
    if (!walletAddress) {
      connectWallet();
      return;
    }
    const refundNote =
      Number.parseFloat(petition?.raisedEth ?? '0') > 0
        ? ' All backers will receive full ETH refunds.'
        : '';
    if (
      !window.confirm(
        `Cancel this community launch?${refundNote} This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setAction('cancel');
    setError(null);
    setMessage(null);
    try {
      const res = await cancelCommunityLaunch({ id, wallet: walletAddress });
      const count = res.refunds?.length ?? 0;
      setMessage(
        count > 0
          ? `Launch cancelled — refunded ${count} backer${count === 1 ? '' : 's'}.`
          : 'Launch cancelled.',
      );
      setPetition(res.petition);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  if (loading && !petition) return <p className="muted">Loading community launch…</p>;
  if (!petition) return <p className="error">{error ?? 'Community launch not found'}</p>;

  const canRefund =
    petition.status === 'open' ||
    petition.status === 'expired' ||
    petition.status === 'failed';
  const canDeposit = petition.status === 'open';
  const isCreator = walletsMatch(walletAddress, petition.starterWallet);
  const myOrder = petition.orders?.find(
    (o) => walletsMatch(o.wallet, walletAddress) && o.status === 'active',
  );
  const hasActiveContribution = Boolean(myOrder);
  const slotMode = petition.agentParticipation.fixedUnitsPerWallet;
  const supportersRemaining = petition.agentParticipation.supportersRemaining;
  const supportersJoined = petition.agentParticipation.supportersJoined;
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
        <TokenAvatar symbol={petition.tokenSymbol} imageUrl={petition.imageUrl} size={64} priority />
        {petition.description ? <p className="petition-lead">{petition.description}</p> : null}
        {petition.websiteUrl || petition.tweetUrl ? (
          <div className="petition-links" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {petition.websiteUrl ? (
              <a href={petition.websiteUrl} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: '0.85rem' }}>
                🌐 Website
              </a>
            ) : null}
            {petition.tweetUrl ? (
              <a href={petition.tweetUrl.startsWith('http') ? petition.tweetUrl : `https://x.com/${petition.tweetUrl.replace(/^@/, '')}`} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: '0.85rem' }}>
                𝕏 {petition.tweetUrl.startsWith('http') ? 'X' : petition.tweetUrl}
              </a>
            ) : null}
          </div>
        ) : null}
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
            <dt>Raised</dt>
            <dd>
              {petition.raisedEth} / {petition.targetRaiseEth} ETH
            </dd>
          </div>
          {canRefund ? (
            <div>
              <dt>Remaining</dt>
              <dd>{petition.remainingEth} ETH to goal</dd>
            </div>
          ) : null}
          <div>
            <dt>Initial LP buy</dt>
            <dd>{petition.targetRaiseEth} ETH at goal</dd>
          </div>
          {slotMode && supportersRemaining != null ? (
            <div>
              <dt>Supporter slots</dt>
              <dd>
                {supportersJoined ?? 0} joined · {supportersRemaining} left
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Holder NFT shares</dt>
            <dd>1,000 total · split pro-rata at launch</dd>
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
          {petition.starterWallet ? (
            <div>
              <dt>Creator</dt>
              <dd className="lp-mono">{shortenAddress(petition.starterWallet)}</dd>
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

        {canDeposit && !hasActiveContribution ? (
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
            <p className="muted token-fee-note">
              Keep a little extra ETH in the same wallet for Robinhood Chain network fees — not just
              the contribution amount.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={onDeposit}
            >
              {busy && action === 'deposit'
                ? 'Sending…'
                : wallet
                  ? 'Send ETH contribution'
                  : 'Connect wallet to back'}
            </button>
          </div>
        ) : null}

        {hasActiveContribution ? (
          <div className="petition-back-block">
            <h2 className="petition-section-title">Your contribution</h2>
            <p className="muted">
              {myOrder!.contributionEth} ETH · ~{myOrder!.estimatedShares} Holder NFT shares at
              current raise
            </p>
            {canRefund ? (
              <div className="petition-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={onRefund}
                >
                  {busy && action === 'refund' ? 'Refunding…' : 'Request refund'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {isCreator && canRefund ? (
          <div className="petition-back-block petition-cancel-block">
            <h2 className="petition-section-title">Creator controls</h2>
            <p className="muted">
              Cancel this launch at any time before the goal is met.
              {Number.parseFloat(petition.raisedEth) > 0
                ? ' All backers will be refunded automatically.'
                : ''}
            </p>
            <div className="petition-actions">
              <button
                type="button"
                className="btn btn-ghost petition-cancel-btn"
                disabled={busy}
                onClick={onCancelLaunch}
              >
                {busy && action === 'cancel' ? 'Cancelling…' : 'Cancel launch & refund all'}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}
      </div>
    </div>
  );
}

export function CommunityLaunchPanel({ embedded = false }: { embedded?: boolean }) {
  redirectLegacyPetitionPath();
  const [petitions, setPetitions] = useState<CommunityLaunchSummary[]>([]);
  const [configOk, setConfigOk] = useState<boolean | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'detail'>(() => {
    const id = readCommunityLaunchIdFromUrl();
    if (id) return 'detail';
    if (readCommunityLaunchCreateFromUrl()) return 'create';
    return 'list';
  });
  const [detailId, setDetailId] = useState<string | null>(readCommunityLaunchIdFromUrl());

  useEffect(() => {
    migrateCommunityLaunchPath();
    const sync = () => {
      redirectLegacyPetitionPath();
      const id = readCommunityLaunchIdFromUrl();
      setDetailId(id);
      setView(id ? 'detail' : readCommunityLaunchCreateFromUrl() ? 'create' : 'list');
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
    <div className={`petition-page${embedded ? ' petition-page--embedded' : ''}`}>
      {!embedded ? (
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
              onClick={() => openCommunityLaunchPage(undefined, { create: true })}
            >
              Start community launch
            </button>
          </div>
        </div>
      ) : view === 'list' ? (
        <div className="petition-page-head petition-page-head--embedded">
          <p className="page-sub">
            Raise ETH together — when the goal is met, hood.markets deploys with that ETH as the
            initial LP and airdrops Holder NFT shares pro-rata to backers.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => openCommunityLaunchPage(undefined, { create: true })}
          >
            Start community launch
          </button>
        </div>
      ) : null}

      {view === 'create' ? (
        <CreatePetitionForm
          onCreated={(id) => {
            openCommunityLaunchPage(id);
          }}
        />
      ) : null}

      {view === 'list' ? (
        <section className="petition-catalog">
          <h2 className="petition-section-title">Open community launches</h2>
          {petitions.length === 0 ? (
            <p className="muted">No open launches yet. Start the first one on hood.markets.</p>
          ) : (
            <div className="petition-grid">
              {petitions.map((p) => (
                <PetitionCard key={p.id} petition={p} onOpen={(id) => openCommunityLaunchPage(id)} />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

/** @deprecated Use CommunityLaunchPanel inside LaunchTab */
export function CommunityLaunchPage() {
  return <CommunityLaunchPanel />;
}
