# hood.markets — Public feed API

> Base URL: `https://api.hood.markets` · Chain: Robinhood (4663)

Public read-only endpoints for Telegram bots, Discord monitors, dashboards, and other automations. No auth required.

## Deployment feed (recommended for bots)

Poll for **new token launches** as they are cataloged.

```
GET /api/feed/deployments?sinceId=0&limit=50
```

| Query | Default | Description |
|-------|---------|-------------|
| `sinceId` | `0` | Return deployments with catalog `id` **greater than** this value |
| `limit` | `50` | Max events per response (1–100) |

### Response

```json
{
  "events": [
    {
      "id": 227,
      "createdAt": "2026-07-07 21:04:20",
      "platform": "web",
      "chain": "robinhood",
      "tokenName": "yerrr",
      "tokenSymbol": "YERRR",
      "tokenAddress": "0x88eac49b6D87c0546a4ad8b7b0E77be93A3e4517",
      "tokenImageUrl": "https://…",
      "feeRecipientAddress": "0xC5f5…454A",
      "deployerLabel": "Embedded wallet (Privy)",
      "transactionHash": "0x…",
      "blockNumber": "3350123",
      "sourceUrl": "",
      "clientKind": "web",
      "feeToSelf": true,
      "links": {
        "tokenPage": "https://hood.markets/?token=0x88ea…",
        "dexscreener": "https://dexscreener.com/robinhood/0x88ea…",
        "explorerToken": "https://robinhoodchain.blockscout.com/token/0x88ea…",
        "explorerTx": "https://robinhoodchain.blockscout.com/tx/0x…",
        "uniswap": "https://app.uniswap.org/swap?chain=robinhood&outputCurrency=0x88ea…"
      }
    }
  ],
  "cursor": { "nextSinceId": 227 },
  "pollAfterMs": 15000
}
```

### Polling pattern

1. Start with `sinceId=0` (or your last saved cursor).
2. Process each event in `events`.
3. Save `cursor.nextSinceId`.
4. Wait `pollAfterMs` (15 seconds), then poll again with `sinceId=<nextSinceId>`.

Events are ordered **oldest-first** within each batch so you process launches in chronological order.

### Example (Node.js)

```js
let sinceId = 0;

async function poll() {
  const res = await fetch(
    `https://api.hood.markets/api/feed/deployments?sinceId=${sinceId}&limit=50`,
  );
  const data = await res.json();

  for (const event of data.events ?? []) {
    console.log(`New launch: $${event.tokenSymbol} ${event.tokenAddress}`);
    console.log(event.links.tokenPage);
    // post to Telegram, Discord, etc.
  }

  sinceId = data.cursor?.nextSinceId ?? sinceId;
  setTimeout(poll, data.pollAfterMs ?? 15_000);
}

poll();
```

### Example (Telegram bot snippet)

```js
async function notifyNewLaunch(bot, chatId, event) {
  const sym = event.tokenSymbol.replace(/^\$/, '');
  const text =
    `🚀 <b>${event.tokenName}</b> ($${sym})\n` +
    `<code>${event.tokenAddress}</code>\n` +
    `<a href="${event.links.tokenPage}">hood.markets</a> · ` +
    `<a href="${event.links.dexscreener}">DexScreener</a>`;
  await bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: false });
}
```

## Full catalog (browse / backfill)

```
GET /api/deployments?limit=100&offset=0
```

Returns `{ deployments, total }` — newest first. Useful for one-time backfills or browsing.

Optional filters:

- `?feeRecipient=0x…` — tokens where that wallet receives fees
- `?deployerPlatform=web&deployerHandle=…` — by deployer
- `?claimed=yes|no` — fee claim status

## Single token lookup

```
GET /api/deployments/:tokenAddress
```

## Market stats & trades

```
GET /api/explore?sort=mcap&limit=50
GET /api/tokens/:tokenAddress/market-stats
GET /api/tokens/:tokenAddress/trades
```

## Built-in Telegram channel feed (hood.markets)

If you run hood.markets itself and want launches posted to **your** Telegram group/channel, set on Railway:

- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `TELEGRAM_FEED_CHAT_ID` — group/channel id
- Optional forum topics: `TELEGRAM_FEED_THREAD_WEB`, `_X`, `_MEME`, etc.

This is separate from the public API — it pushes from the server when a deploy is cataloged.

## Rate limits

- Poll `/api/feed/deployments` at most every **10–15 seconds**.
- `limit` max **100** per request.
- No API key required today; please be polite with polling volume.

## CORS

Browser requests from `https://hood.markets` are allowed. Server-side bots do not need CORS.
