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

function buildDeploymentConfig(input: HoodMarketsV3DeployInput) {
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
  } as const;
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

  const hash = await walletClient.writeContract({
    address: factory,
    abi: HOODMARKETS_V3_ABI,
    functionName: 'deployToken',
    args: [deploymentConfig],
    value: input.devBuyAmount,
    account,
    chain: walletClient.chain,
    gas: 8_000_000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`HoodMarkets V3 deploy failed (tx ${hash})`);
  }

  let tokenAddress: Address | undefined;
  let positionId: bigint | undefined;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== factory.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: HOODMARKETS_V3_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'TokenCreated') {
        const args = decoded.args as {
          tokenAddress: Address;
          positionId: bigint;
        };
        tokenAddress = args.tokenAddress;
        positionId = args.positionId;
        break;
      }
    } catch {
      // not our event
    }
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
