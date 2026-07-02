import {
  getAddress,
  type Address,
  type Hash,
  type PublicClient,
} from 'viem';
import { config } from '../config.js';
import { robinhood } from './robinhoodChain.js';
import {
  assertHoodMarketsV3Factory,
  buildHoodMarketsV3DeploymentConfig,
  parseHoodMarketsV3TokenCreatedFromReceipt,
} from './hoodmarketsV3Deploy.js';
import { buildWebDeployArtifacts } from './webDeployArtifacts.js';
import {
  deserializeV3DeploymentConfig,
  serializeV3DeploymentConfig,
  v3DeploymentConfigRewardRecipient,
  type SerializedV3DeploymentConfig,
} from './v3DeploymentConfigJson.js';
import { assertWalletDeploySenderMatches } from './webWalletDeploy.js';

export type WebWalletDeployV3PrepareInput = {
  name: string;
  symbol: string;
  tokenAdmin: string;
  devBuyAmount: bigint;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  xUrl?: string;
  platform?: string;
  clientKind?: 'web' | 'agent';
};

export type WebWalletDeployV3PrepareResult = {
  mode: 'wallet';
  factoryKind: 'hoodmarkets-v3';
  factory: `0x${string}`;
  deploymentConfig: SerializedV3DeploymentConfig;
  msgValueWei: string;
  gas: string;
  chainId: number;
  imageUrl: string;
};

export async function buildWebWalletDeployPrepareV3(
  input: WebWalletDeployV3PrepareInput,
): Promise<WebWalletDeployV3PrepareResult> {
  if (input.devBuyAmount <= 0n) {
    throw new Error('Initial buy amount must be greater than 0 for wallet deploy.');
  }

  const factory = assertHoodMarketsV3Factory(config.hoodmarketsV3.factory);
  const tokenAdmin = getAddress(input.tokenAdmin);

  const { image, metadata, context } = await buildWebDeployArtifacts({
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    imageUrl: input.imageUrl,
    websiteUrl: input.websiteUrl,
    xUrl: input.xUrl,
    platform: input.platform,
    clientKind: input.clientKind,
  });

  const deploymentConfig = buildHoodMarketsV3DeploymentConfig({
    name: input.name,
    symbol: input.symbol,
    tokenAdmin,
    image,
    metadata,
    context,
  });

  return {
    mode: 'wallet',
    factoryKind: 'hoodmarkets-v3',
    factory,
    deploymentConfig: serializeV3DeploymentConfig(deploymentConfig),
    msgValueWei: input.devBuyAmount.toString(),
    gas: '15000000',
    chainId: robinhood.id,
    imageUrl: image,
  };
}

export type WebWalletDeployV3CompleteInput = {
  transactionHash: string;
  expectedTokenAdmin: string;
  deploymentConfig: SerializedV3DeploymentConfig;
  expectedMsgValueWei: bigint;
  /** When set, tx must be sent from this wallet (e.g. deployer paying seed for someone else). */
  expectedSigner?: string;
};

export type WebWalletDeployV3CompleteResult = {
  tokenAddress: `0x${string}`;
  poolId: string;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
};

export async function completeWebWalletDeployV3(
  publicClient: PublicClient,
  input: WebWalletDeployV3CompleteInput,
): Promise<WebWalletDeployV3CompleteResult> {
  const txHash = input.transactionHash.trim() as Hash;
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error('Invalid transaction hash.');
  }

  const expectedAdmin = getAddress(input.expectedTokenAdmin);
  const deploymentConfig = deserializeV3DeploymentConfig(input.deploymentConfig);
  const rewardRecipient = getAddress(v3DeploymentConfigRewardRecipient(deploymentConfig));
  if (rewardRecipient !== expectedAdmin) {
    throw new Error('Deployment config fee wallet mismatch.');
  }

  const tx = await publicClient.getTransaction({ hash: txHash });
  const expectedSigner = input.expectedSigner?.trim()
    ? getAddress(input.expectedSigner)
    : expectedAdmin;
  assertWalletDeploySenderMatches(tx?.from, expectedSigner);
  if ((tx?.value ?? 0n) !== input.expectedMsgValueWei) {
    throw new Error('Deploy transaction value does not match initial buy amount.');
  }

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 180_000,
  });

  if (receipt.status !== 'success') {
    throw new Error(
      `deployToken transaction reverted: ${txHash} (see https://robinhoodchain.blockscout.com/tx/${txHash})`,
    );
  }

  const factory = assertHoodMarketsV3Factory(config.hoodmarketsV3.factory);
  const created = parseHoodMarketsV3TokenCreatedFromReceipt(receipt, factory);

  return {
    tokenAddress: created.tokenAddress,
    poolId: `v3:${created.positionId.toString()}`,
    transactionHash: txHash,
    blockNumber: receipt.blockNumber,
  };
}
