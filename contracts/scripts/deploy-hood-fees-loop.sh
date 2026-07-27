#!/usr/bin/env bash
# Deploy HoodFeeLock + HoodFeesRouter on Robinhood Chain (4663).
# Usage:
#   ./scripts/deploy-hood-fees-loop.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-$ROOT/.env.robinhood}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.robinhood.example and set DEPLOYER_PRIVATE_KEY"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY in $ENV_FILE}"
: "${ROBINHOOD_RPC_URL:?Set ROBINHOOD_RPC_URL}"
: "${WETH:?Set WETH}"
: "${HOODMARKETS_PLATFORM_FEE_RECIPIENT:?Set HOODMARKETS_PLATFORM_FEE_RECIPIENT}"

if [[ "$DEPLOYER_PRIVATE_KEY" != 0x* && "$DEPLOYER_PRIVATE_KEY" != 0X* ]]; then
  export DEPLOYER_PRIVATE_KEY="0x${DEPLOYER_PRIVATE_KEY}"
fi

export HOOD_FEES_TRADER_REWARDS="${HOOD_FEES_TRADER_REWARDS:-$HOODMARKETS_PLATFORM_FEE_RECIPIENT}"

RPC="$ROBINHOOD_RPC_URL"
CHAIN_ID=4663
DEPLOYER="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"

echo "Deployer: $DEPLOYER"
echo "Owner: ${HOODMARKETS_OWNER:-<same as deployer>}"
echo "WETH: $WETH"
echo "Trader rewards (25%): $HOOD_FEES_TRADER_REWARDS"
echo "Balance: $(cast balance "$DEPLOYER" --rpc-url "$RPC") wei"
echo ""

forge script script/robinhood/12_DeployHoodFeesLoop.s.sol:DeployHoodFeesLoop \
  --rpc-url "$RPC" \
  --chain-id "$CHAIN_ID" \
  --broadcast \
  --slow \
  -vvv

BROADCAST_DIR="$ROOT/broadcast/12_DeployHoodFeesLoop.s.sol/$CHAIN_ID"
LATEST=$(ls -t "$BROADCAST_DIR"/run-*.json 2>/dev/null | head -1 || true)
if [[ -z "$LATEST" ]]; then
  echo "No broadcast file found — check forge output above."
  exit 1
fi

FEE_LOCK=$(jq -r '.transactions[] | select(.contractName=="HoodFeeLock") | .contractAddress' "$LATEST" | head -1)
ROUTER=$(jq -r '.transactions[] | select(.contractName=="HoodFeesRouter") | .contractAddress' "$LATEST" | head -1)

echo ""
echo "=== Hood Fees Loop deployed ==="
echo "HoodFeeLock:     $FEE_LOCK"
echo "HoodFeesRouter:  $ROUTER"
echo "Blockscout lock: https://robinhoodchain.blockscout.com/address/$FEE_LOCK"
echo "Blockscout router: https://robinhoodchain.blockscout.com/address/$ROUTER"
echo ""
echo "Next:"
echo "  1. Launch \$FEES with fee recipient = $ROUTER"
echo "  2. router.setFeesToken(\$FEES)"
echo "  3. router.setFeesFraction(fractionCollection)"
