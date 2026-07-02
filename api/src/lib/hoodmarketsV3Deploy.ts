import { randomBytes } from 'node:crypto';
import {
  decodeEventLog,
  getAddress,
  keccak256,
  toHex,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { HOODMARKETS_V3_ABI } from './hoodmarketsV3Abi.js';
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_WETH } from './robinhoodChain.js';

/** ~$10k FDV at ~$40k ETH — same starting price family as upstream v3.1 WETH launches. */
const DEFAULT_INITIAL_TICK = -230400;
const POOL_FEE = 10_000; // 1%

export type HoodMarketsV3DeployInput = {
  factory: Address;
  name: string;
  symbol: string;
  tokenAdmin: Address;
  image: string;
  metadata: string;
  context: string;
  /** ETH attached to `deployToken` for optional initial buy (wei). */
  devBuyAmount: bigint;
};

export type HoodMarketsV3DeployResult = {
  tokenAddress: Address;
  positionId: bigint;
  poolId: string;
  transactionHash: Hex;
  blockNumber: bigint;
};

export function assertHoodMarketsV3Factory(factory: string | undefined): Address {
  if (!factory?.trim()) {
    throw new Error(
      'HOODMARKETS_V3_FACTORY is not set — deploy HoodMarkets V3 on Robinhood first (10_DeployHoodMarketsV3.s.sol).',
    );
  }
  return getAddress(factory.trim());
}

export type HoodMarketsV3DeploymentConfig = {
  tokenConfig: {
    name: string;
    symbol: string;
    salt: Hex;
    image: string;
    metadata: string;
    context: string;
    originatingChainId: bigint;
  };
  vaultConfig: {
    vaultPercentage: number;
    vaultDuration: bigint;
  };
  poolConfig: {
    pairedToken: Address;
    tickIfToken0IsNewToken: number;
  };
  initialBuyConfig: {
    pairedTokenPoolFee: number;
    pairedTokenSwapAmountOutMinimum: bigint;
  };
  rewardsConfig: {
    creatorReward: bigint;
    creatorAdmin: Address;
    creatorRewardRecipient: Address;
    interfaceAdmin: Address;
    interfaceRewardRecipient: Address;
  };
};

export function buildHoodMarketsV3DeploymentConfig(input: {
  name: string;
  symbol: string;
  tokenAdmin: Address;
  image: string;
  metadata: string;
  context: string;
}): HoodMarketsV3DeploymentConfig {
  const salt = keccak256(toHex(randomBytes(32)));
  const tokenAdmin = getAddress(input.tokenAdmin);

  return {
    tokenConfig: {
      name: input.name,
      symbol: input.symbol,
      salt,
      image: input.image,
      metadata: input.metadata,
      context: input.context,
      originatingChainId: BigInt(ROBINHOOD_CHAIN_ID),
    },
    vaultConfig: {
      vaultPercentage: 0,
      vaultDuration: 0n,
    },
    poolConfig: {
      pairedToken: ROBINHOOD_WETH,
      tickIfToken0IsNewToken: DEFAULT_INITIAL_TICK,
    },
    initialBuyConfig: {
      pairedTokenPoolFee: POOL_FEE,
      pairedTokenSwapAmountOutMinimum: 0n,
    },
    rewardsConfig: {
      /** 95% of swap fees to creator; 5% platform is fixed in HoodMarketsV3LpLocker. */
      creatorReward: 95n,
      creatorAdmin: tokenAdmin,
      creatorRewardRecipient: tokenAdmin,
      interfaceAdmin: tokenAdmin,
      interfaceRewardRecipient: '0x0000000000000000000000000000000000000000' as Address,
    },
  };
}

function buildDeploymentConfig(input: HoodMarketsV3DeployInput) {
  return buildHoodMarketsV3DeploymentConfig({
    name: input.name,
    symbol: input.symbol,
    tokenAdmin: getAddress(input.tokenAdmin),
    image: input.image,
    metadata: input.metadata,
    context: input.context,
  });
}

export function parseHoodMarketsV3TokenCreatedFromReceipt(
  receipt: { logs: { address: string; data: Hex; topics: readonly Hex[] }[] },
  factory: Address,
): { tokenAddress: Address; positionId: bigint } {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== factory.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: HOODMARKETS_V3_ABI,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (decoded.eventName === 'TokenCreated') {
        const args = decoded.args as {
          tokenAddress: Address;
          positionId: bigint;
        };
        return { tokenAddress: args.tokenAddress, positionId: args.positionId };
      }
    } catch {
      // not our event
    }
  }
  throw new Error('TokenCreated event not found in transaction receipt');
}

export async function deployHoodMarketsV3Token(
  publicClient: PublicClient,
  walletClient: WalletClient,
  input: HoodMarketsV3DeployInput,
): Promise<HoodMarketsV3DeployResult> {
  const factory = getAddress(input.factory);
  const deploymentConfig = buildDeploymentConfig(input);
  const account = walletClient.account;
  if (!account) {
    throw new Error('Wallet client has no account');
  }

  const writeParams = {
    address: factory,
    abi: HOODMARKETS_V3_ABI,
    functionName: 'deployToken' as const,
    args: [deploymentConfig] as const,
    value: input.devBuyAmount,
    account,
  };

  /** V3 deploy + pool mint + LP lock + initial buy often exceeds 8M gas on Robinhood. */
  let gasLimit = 15_000_000n;
  try {
    const estimated = await publicClient.estimateContractGas(writeParams);
    gasLimit = estimated + estimated / 4n;
    if (gasLimit < 12_000_000n) gasLimit = 12_000_000n;
    if (gasLimit > 20_000_000n) gasLimit = 20_000_000n;
  } catch {
    gasLimit = 15_000_000n;
  }

  const hash = await walletClient.writeContract({
    ...writeParams,
    chain: walletClient.chain,
    gas: gasLimit,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    const used = receipt.gasUsed;
    const likelyOog = used >= (gasLimit * 95n) / 100n;
    throw new Error(
      likelyOog
        ? `HoodMarkets V3 deploy ran out of gas (used ${used} / limit ${gasLimit}). Tx: ${hash}`
        : `HoodMarkets V3 deploy reverted on-chain. Tx: ${hash}`,
    );
  }

  let tokenAddress: Address | undefined;
  let positionId: bigint | undefined;

  try {
    const created = parseHoodMarketsV3TokenCreatedFromReceipt(receipt, factory);
    tokenAddress = created.tokenAddress;
    positionId = created.positionId;
  } catch {
    tokenAddress = undefined;
    positionId = undefined;
  }

  if (!tokenAddress || positionId === undefined) {
    throw new Error(`TokenCreated event not found in tx ${hash}`);
  }

  return {
    tokenAddress,
    positionId,
    poolId: `v3:${positionId.toString()}`,
    transactionHash: hash,
    blockNumber: receipt.blockNumber,
  };
}
