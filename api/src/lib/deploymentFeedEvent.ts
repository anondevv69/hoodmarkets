import type { DeploymentCatalogRow } from './deploymentCatalog.js';
import { hoodmarketsTokenUrl } from './launcherAppUrl.js';

export type DeploymentFeedEvent = {
  id: number;
  createdAt: string;
  platform: string;
  chain: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenImageUrl?: string;
  tokenDescription?: string;
  feeRecipientAddress: string;
  feeRecipientLabel?: string;
  deployerLabel: string;
  transactionHash: string;
  blockNumber: string;
  sourceUrl?: string;
  clientKind?: string;
  feeToSelf?: boolean;
  links: {
    tokenPage: string;
    dexscreener: string;
    explorerToken: string;
    explorerTx: string;
    uniswap: string;
  };
};

function tokenLowerHex(address: string): string {
  return address.trim().toLowerCase();
}

export function buildDeploymentFeedEvent(row: DeploymentCatalogRow): DeploymentFeedEvent {
  const addr = tokenLowerHex(row.tokenAddress);
  const chain = (row.chain || 'robinhood').trim().toLowerCase();
  const dexNetwork = chain === 'robinhood' ? 'robinhood' : chain;

  return {
    id: row.id,
    createdAt: row.createdAt,
    platform: row.platform,
    chain,
    tokenName: row.tokenName,
    tokenSymbol: row.tokenSymbol.replace(/^\$/, ''),
    tokenAddress: row.tokenAddress,
    tokenImageUrl: row.tokenImageUrl?.trim() || undefined,
    tokenDescription: row.tokenDescription?.trim() || undefined,
    feeRecipientAddress: row.feeRecipientAddress,
    feeRecipientLabel: row.feeRecipientLabel?.trim() || undefined,
    deployerLabel: row.deployerLabel,
    transactionHash: row.transactionHash,
    blockNumber: row.blockNumber,
    sourceUrl: row.sourceUrl?.trim() || undefined,
    clientKind: row.clientKind?.trim() || undefined,
    feeToSelf: row.feeToSelf,
    links: {
      tokenPage: hoodmarketsTokenUrl(row.tokenAddress),
      dexscreener: `https://dexscreener.com/${dexNetwork}/${addr}`,
      explorerToken: `https://robinhoodchain.blockscout.com/token/${addr}`,
      explorerTx: `https://robinhoodchain.blockscout.com/tx/${row.transactionHash}`,
      uniswap: `https://app.uniswap.org/swap?chain=robinhood&outputCurrency=${row.tokenAddress}`,
    },
  };
}
