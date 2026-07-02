# One-line intents → API

| User message (examples) | Action |
|-------------------------|--------|
| launch X on hood / deploy $SYM hoodmarkets | `preflight-deploy` → `prepare-deploy` with `agentChannel: "x"` → confirm in-thread → deploy (no haiku) |
| launch token via API agent (not X) | `preflight-deploy` → `prepare-deploy` → haiku captcha → POST /api/deploy |
| my hood tokens / what did I launch | GET /api/agent/briefing |
| is $MTK simple or pro / how do I buy MTK | GET /api/agent/token-info?symbol=MTK |
| buy 0.01 eth of 0x… hood | token-info → if pro: prepare-buy → Bankr submit; if simple: Uniswap link |
| sell 1M MTK on hoodmarkets | token-info → if pro: prepare-sell → Bankr submit |
| claim fees MTK / claim hood fees | captcha JWT → POST /api/agent/claim |
| list hoodmarkets tokens | GET /api/deployments |
| simple launch on hood | deploy with `"launchMode": "simple"` |
| pro launch hoodmarkets | deploy with `"launchMode": "pro"` |

Tweet/DM to `@bankrbot` uses the same mapping.

## Blocked deploy replies (use API `replyHint`)

| Situation | Example reply |
|-----------|----------------|
| Ticker taken (cooldown) | `$PEPE is taken on hood.markets for now — try another symbol or wait 24h.` |
| Name taken | `That name was used recently on hood.markets — pick another name.` |
| Wallet daily limit | `Your wallet hit hood.markets' deploy limit — wait or use another fee wallet.` |
| Reserved ticker | `$HOOD is reserved — choose a different symbol.` |
| Rate limit warning (proceed) | `You can still launch, but fees may go to burn if you hit the daily cap.` |

Always call `preflight-deploy` or `prepare-deploy` first — do not guess.
