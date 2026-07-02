# Bankr /wallet/submit

Use `POST https://api.bankr.bot/wallet/submit` with write-enabled API key.

## Robinhood Chain

Set `"chainId": 4663` on every hood.markets swap transaction.

## untrusted_address

If Bankr blocks a transaction with `untrusted_address`:

1. **Stop** — do not retry with different encoding
2. **Do not** tell the user to use the web UI to bypass the scanner
3. Explain the contract is not on Bankr's allowlist yet
4. For swaps, suggest Uniswap (`uniswapSwapUrl` from prepare-buy response)

## Order

Sell: `approve` (if in `transactions[]`) → `sell`  
Buy: single `buy` tx

Use `"waitForConfirmation": true` on each submit.
