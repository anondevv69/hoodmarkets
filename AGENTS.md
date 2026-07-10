# Agent notes — hood.markets

## UI / frontend

When editing `web/src` components or styles, follow **`.cursor/rules/design-engineering.mdc`**.

Optional external reference (install locally):

```bash
npx skills@latest add emilkowalski/skills
```

## API / Bankr skill

Agent API docs live in `skills/hoodmarkets/`. Use `https://api.hood.markets` for all agent POST routes.

## Monorepo layout

| Path | Role |
|------|------|
| `contracts/` | HoodMarkets V3 Solidity |
| `api/` | Express API + agent routes |
| `web/` | Vite React frontend |
| `skills/hoodmarkets/` | Bankr agent skill (publish to Hood-Market-Skill separately) |
