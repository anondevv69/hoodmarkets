import { useEffect, useMemo, useState } from 'react';
import { fetchQuoteTokens, type QuoteTokenOption } from '../api';

type QuoteTokenSelectProps = {
  value: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
};

export function QuoteTokenSelect({ value, onChange, disabled }: QuoteTokenSelectProps) {
  const [tokens, setTokens] = useState<QuoteTokenOption[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchQuoteTokens({ liquidity: true })
      .then((list) => {
        if (!cancelled) {
          setTokens(list);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load quote tokens.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = tokens.find((t) => t.symbol === value) ?? tokens.find((t) => t.symbol === 'WETH');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tokens.slice(0, 40);
    return tokens
      .filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [query, tokens]);

  return (
    <div className="quote-token-select">
      <label>
        Quote pair
        <button
          type="button"
          className="quote-token-trigger lp-input"
          disabled={disabled || loading}
          onClick={() => setOpen((v) => !v)}
        >
          {loading ? (
            'Loading pairs…'
          ) : selected ? (
            <span className="quote-token-trigger-inner">
              {selected.logoUrl ? (
                <img src={selected.logoUrl} alt="" className="quote-token-logo" width={20} height={20} />
              ) : null}
              <span>
                ${selected.symbol}
                <span className="muted"> · {selected.name}</span>
              </span>
            </span>
          ) : (
            `$${value || 'WETH'}`
          )}
        </button>
      </label>
      {error ? (
        <p className="muted" style={{ fontSize: '0.8rem', margin: '0.35rem 0 0' }}>
          {error}
        </p>
      ) : null}
      {!selected?.hasWethLiquidity && selected && selected.symbol !== 'WETH' ? (
        <p className="muted" style={{ fontSize: '0.8rem', margin: '0.35rem 0 0' }}>
          No WETH/{selected.symbol} pool yet — launch may fail. Pick WETH or a token with liquidity.
        </p>
      ) : null}
      {open ? (
        <div className="quote-token-dropdown">
          <input
            className="lp-input"
            placeholder="Search NVDA, AAPL, USDG…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <ul className="quote-token-list">
            {filtered.map((t) => (
              <li key={t.address}>
                <button
                  type="button"
                  className={`quote-token-option${t.symbol === value ? ' is-active' : ''}`}
                  onClick={() => {
                    onChange(t.symbol);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {t.logoUrl ? (
                    <img src={t.logoUrl} alt="" className="quote-token-logo" width={24} height={24} />
                  ) : (
                    <span className="quote-token-logo quote-token-logo--placeholder" aria-hidden />
                  )}
                  <span>
                    <strong>${t.symbol}</strong>
                    <span className="muted"> {t.name}</span>
                    {t.hasWethLiquidity === false ? (
                      <span className="muted"> · no WETH pool</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="muted" style={{ fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
        Launch your meme paired against WETH, USDG, or any Robinhood stock token. Pool seed is still paid in ETH.
      </p>
    </div>
  );
}
