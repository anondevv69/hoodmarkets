# HoodMarkets protocol (Robinhood Chain)

Smart contracts for **[hood.markets](https://hood.markets)** — token factory on Robinhood Chain (4663), forked from Liquid Protocol v4 / Clanker v4.

Factory contract: **`HoodMarkets`** (`PROTOCOL = "hoodmarkets"`).

Supporting modules use the `HoodMarkets*` prefix (fee locker, hooks, LP locker, dev buy, MEV).

## Robinhood mainnet deploy

See [`deployed-robinhood-mainnet.json`](deployed-robinhood-mainnet.json) and [`../README.md`](../README.md).

```bash
cp .env.robinhood.example .env.robinhood   # local only — never commit
./scripts/deploy-robinhood.sh
./scripts/verify-robinhood.sh
```

## Build

```bash
git submodule update --init --recursive
forge build
```

## Base mainnet

This tree also contains Liquid Protocol Base mainnet artifacts and vault code from upstream. **hood.markets production uses the Robinhood deploy only.**

See the original [`README.md`](README.md) body below for Base addresses and architecture.

---
