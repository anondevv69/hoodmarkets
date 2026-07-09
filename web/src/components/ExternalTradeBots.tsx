import { buildExternalTradeBotLinks } from '../lib/externalTradeBots';

export function ExternalTradeBots({ tokenAddress }: { tokenAddress: string }) {
  const links = buildExternalTradeBotLinks(tokenAddress);

  return (
    <div className="external-trade-bots">
      <p className="external-trade-bots-label">Trade on</p>
      <div className="external-trade-bots-grid">
        {links.map((bot) => (
          <a
            key={bot.id}
            className="external-trade-bot-link"
            href={bot.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={`external-trade-bot-icon external-trade-bot-icon--${bot.id}`} aria-hidden>
              {bot.id === 'basedBot' ? 'B' : bot.id === 'maestro' ? 'M' : bot.id === 'sigma' ? 'Σ' : 'G'}
            </span>
            <span className="external-trade-bot-name">{bot.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
