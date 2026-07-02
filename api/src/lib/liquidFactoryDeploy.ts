import { randomBytes } from 'node:crypto';
import {
  decodeEventLog,
  getAddress,
  isAddress,
  toHex,
  type Address,
  type PublicClient,
  type WalletClient,
  type Hex,
} from 'viem';
import { LiquidFactoryAbi } from 'liquid-sdk';
import { config } from '../config.js';
import { buildLiquidDevBuyExtension } from './liquidDevBuyExtension.js';
import {
  CHAIN_WETH,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_WETH,
  robinhood,
} from './robinhoodChain.js';

/** Factory ABI — from `liquid-sdk` (correct `payable` typing for `deployToken` + `value`). */
export const LIQUID_FACTORY_ABI = LiquidFactoryAbi;

/** Robinhood WETH — alias `BASE_WETH` for legacy imports. */
export const BASE_WETH = ROBINHOOD_WETH;

export function liquidMevModule(): `0x${string}` {
  const addr = config.liquid.mevModule;
  if (!addr) {
    throw new Error(
      'LIQUID_SNIPER_AUCTION_V2 is not set — deploy Liquid Protocol on Robinhood first.',
    );
  }
  return addr;
}

/** `deployToken` + dev-buy extension can exceed 5M gas on Base; BaseScan shows OOG at exactly 5M. */
const DEFAULT_DEPLOY_TOKEN_GAS_WITH_VALUE = 12_000_000n;

function deployTokenGasLimitWithValue(): bigint {
  const raw = process.env.DEPLOY_TOKEN_GAS?.trim();
  if (raw) {
    const n = BigInt(raw);
    if (n >= 3_000_000n) return n;
  }
  return DEFAULT_DEPLOY_TOKEN_GAS_WITH_VALUE;
}

/** Presets decoded from real on-chain `deployToken` calls — only token/admin fields are substituted. */
const STATIC_PRESET = {
  poolConfig: {
    pairedToken: CHAIN_WETH,
    tickIfToken0IsLiquid: -232600,
    tickSpacing: 200,
    poolData:
      '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000002710' as Hex,
  },
  lockerConfig: {
    tickLower: [-232600, -200400, -170400] as const,
    tickUpper: [-200400, -170400, -124400] as const,
    positionBps: [4000, 5000, 1000] as const,
    rewardBps: [8000, 2000] as const,
    lockerData:
      '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as Hex,
  },
  mevModuleData:
    '0x00000000000000000000000000000000000000000000000000000000000c35000000000000000000000000000000000000000000000000000000000000061a800000000000000000000000000000000000000000000000000000000000000014' as Hex,
} as const;

const DYNAMIC_PRESET = {
  poolConfig: {
    pairedToken: CHAIN_WETH,
    tickIfToken0IsLiquid: -230400,
    tickSpacing: 200,
    poolData:
      '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000c35000000000000000000000000000000000000000000000000000000000000002580000000000000000000000000000000000000000000000000000000000000e1000000000000000000000000000000000000000000000000000000000000003e8000000000000000000000000000000000000000000000000000000000000c3500000000000000000000000000000000000000000000000000000000000001388' as Hex,
  },
  lockerConfig: {
    tickLower: [-230400, -216000, -202000, -155000, -141000] as const,
    tickUpper: [-216000, -155000, -155000, -120000, -120000] as const,
    positionBps: [1000, 5000, 1500, 2000, 500] as const,
    rewardBps: [10000] as const,
    lockerData:
      '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001' as Hex,
  },
  mevModuleData:
    '0x00000000000000000000000000000000000000000000000000000000000c35000000000000000000000000000000000000000000000000000000000000061a800000000000000000000000000000000000000000000000000000000000000014' as Hex,
} as const;

export type DeployTokenArgs = {
  factory: `0x${string}`;
  hookStatic: `0x${string}`;
  hookDynamic: `0x${string}`;
  lpLocker: `0x${string}`;
  name: string;
  symbol: string;
  tokenAdmin: `0x${string}`;
  hookType: 'dynamic' | 'static';
  image: string;
  metadata: string;
  context: string;
  /**
   * Optional launch-time ETH→token swap via Univ4EthDevBuy (same tx as deploy).
   * `recipient` is usually the token admin (fee wallet). Omit or zero wei to skip.
   */
  devBuy?: { ethAmount: bigint; recipient: `0x${string}` };
  /**
   * CREATE2 salt. When omitted, a random salt is used (or one mined to match
   * `VANITY_ADDRESS_SUFFIX` inside `deployTokenOnchain`).
   */
  salt?: Hex;
  /** Rate-limit excess: 100% of LP fees to platform recipient instead of token admin split. */
  feesToPlatformOnly?: boolean;
};

export type OnchainDeployResult = {
  tokenAddress: `0x${string}`;
  poolId: `0x${string}`;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
};

function buildDeploymentConfig(
  input: DeployTokenArgs,
  platformFeeRecipient?: `0x${string}`,
  platformFeeBps?: number
) {
  const hook =
    input.hookType === 'dynamic' ? input.hookDynamic : input.hookStatic;
  const preset = input.hookType === 'dynamic' ? DYNAMIC_PRESET : STATIC_PRESET;

  const salt = input.salt ?? toHex(randomBytes(32));

  const tokenAdmin = getAddress(input.tokenAdmin);

  // Determine reward recipients based on preset and platform fee
  const rewardAdmins: `0x${string}`[] = [];
  const rewardRecipients: `0x${string}`[] = [];
  const rewardBpsArr: number[] = [];

  if (input.feesToPlatformOnly) {
    if (!platformFeeRecipient) {
      throw new Error('Platform fee recipient required when feesToPlatformOnly is set');
    }
    const plat = getAddress(platformFeeRecipient);
    rewardRecipients.push(plat);
    rewardAdmins.push(plat);
    rewardBpsArr.push(10000);
  } else if (platformFeeRecipient && platformFeeBps && platformFeeBps > 0) {
    // With platform fee: 2 recipients (creator + platform), total 10000 BPS
    const creatorBps = 10000 - platformFeeBps;
    if (creatorBps < 0) {
      throw new Error(
        `Platform fee ${platformFeeBps} BPS exceeds max 10000 BPS`
      );
    }
    rewardRecipients.push(tokenAdmin, getAddress(platformFeeRecipient));
    rewardAdmins.push(tokenAdmin, getAddress(platformFeeRecipient));
    rewardBpsArr.push(creatorBps, platformFeeBps);
  } else {
    // Without platform fee: use preset as-is
    if (preset.lockerConfig.rewardBps.length === 2) {
      // Static preset: 2 recipients (8000/2000)
      rewardAdmins.push(tokenAdmin, tokenAdmin);
      rewardRecipients.push(tokenAdmin, tokenAdmin);
      rewardBpsArr.push(8000, 2000);
    } else {
      // Dynamic preset: 1 recipient (10000)
      rewardAdmins.push(tokenAdmin);
      rewardRecipients.push(tokenAdmin);
      rewardBpsArr.push(10000);
    }
  }

  return {
    tokenConfig: {
      tokenAdmin,
      name: input.name,
      symbol: input.symbol,
      salt,
      image: input.image,
      metadata: input.metadata,
      context: input.context,
      originatingChainId: BigInt(ROBINHOOD_CHAIN_ID),
    },
    poolConfig: {
      hook,
      pairedToken: preset.poolConfig.pairedToken,
      tickIfToken0IsLiquid: preset.poolConfig.tickIfToken0IsLiquid,
      tickSpacing: preset.poolConfig.tickSpacing,
      poolData: preset.poolConfig.poolData,
    },
    lockerConfig: {
      locker: input.lpLocker,
      rewardAdmins,
      rewardRecipients,
      rewardBps: rewardBpsArr,
      tickLower: [...preset.lockerConfig.tickLower],
      tickUpper: [...preset.lockerConfig.tickUpper],
      positionBps: [...preset.lockerConfig.positionBps],
      lockerData: preset.lockerConfig.lockerData,
    },
    mevModuleConfig: {
      mevModule: liquidMevModule(),
      mevModuleData: preset.mevModuleData,
    },
    extensionConfigs: (() => {
      const eth = input.devBuy?.ethAmount ?? 0n;
      if (!input.devBuy || eth <= 0n) return [];
      return [
        buildLiquidDevBuyExtension(eth, getAddress(input.devBuy.recipient)),
      ];
    })(),
  };
}

export function assertValidTokenAdmin(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new Error(
      `Invalid token admin address: ${address}. User must provide a valid 0x wallet.`
    );
  }
  return getAddress(address);
}

/** Normalize env `VANITY_ADDRESS_SUFFIX` to lowercase hex (no 0x). */
function normalizeVanitySuffix(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (s.startsWith('0x')) s = s.slice(2);
  if (!/^[0-9a-f]+$/.test(s)) {
    throw new Error(
      `VANITY_ADDRESS_SUFFIX must be hex digits (e.g. 1c3); got: ${raw}`
    );
  }
  if (s.length < 1 || s.length > 40) {
    throw new Error(
      'VANITY_ADDRESS_SUFFIX must be 1–40 hex characters (20-byte address tail).'
    );
  }
  return s;
}

/**
 * Brute-force a CREATE2 salt by simulating `deployToken` until the returned token
 * address ends with the desired hex suffix. Uses on-chain simulation so the
 * result matches the factory exactly (init code depends on full config + salt).
 *
 * **Performance:** Each attempt is an RPC round-trip. Use `VANITY_SALT_CONCURRENCY`
 * (parallel simulations per batch) and a low-latency `BASE_RPC_URL` — sequential
 * mining is intentionally slow on remote RPCs (e.g. 25k attempts × 80ms ≈ 30+ min).
 */
async function mineVanitySalt(
  publicClient: PublicClient,
  account: Address,
  input: DeployTokenArgs,
  platformFeeRecipient: `0x${string}` | undefined,
  platformFeeBps: number | undefined,
  suffix: string
): Promise<Hex> {
  const maxAttempts = (() => {
    const raw = process.env.VANITY_SALT_MAX_ATTEMPTS?.trim();
    if (!raw) return 1_000_000;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error('VANITY_SALT_MAX_ATTEMPTS must be a positive integer');
    }
    return n;
  })();

  const concurrency = (() => {
    const raw = process.env.VANITY_SALT_CONCURRENCY?.trim();
    if (!raw) return 32;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error('VANITY_SALT_CONCURRENCY must be a positive integer');
    }
    return Math.min(256, n);
  })();

  const simGas =
    deploymentConfigExtensionMsgValue(input, platformFeeRecipient, platformFeeBps) >
    0n
      ? deployTokenGasLimitWithValue()
      : undefined;

  let lastErr: unknown;
  let totalAttempts = 0;
  let lastProgressLog = 0;

  const tryCandidate = async (candidate: Hex): Promise<Address | null> => {
    const deploymentConfig = buildDeploymentConfig(
      { ...input, salt: candidate },
      platformFeeRecipient,
      platformFeeBps
    );
    const msgValue = deploymentConfig.extensionConfigs.reduce(
      (sum, ext) => sum + ext.msgValue,
      0n
    );
    try {
      const { result } = await publicClient.simulateContract({
        address: input.factory,
        abi: LIQUID_FACTORY_ABI,
        functionName: 'deployToken',
        args: [deploymentConfig],
        account,
        value: msgValue,
        ...(simGas !== undefined ? { gas: simGas } : {}),
      });
      const tokenAddress = getAddress(result as Address);
      if (tokenAddress.toLowerCase().endsWith(suffix)) {
        return tokenAddress;
      }
    } catch (e) {
      lastErr = e;
    }
    return null;
  };

  while (totalAttempts < maxAttempts) {
    const batch = Math.min(concurrency, maxAttempts - totalAttempts);
    const candidates = Array.from(
      { length: batch },
      () => toHex(randomBytes(32)) as Hex
    );
    const results = await Promise.all(
      candidates.map((salt) =>
        tryCandidate(salt).then((addr) => ({ salt, addr }))
      )
    );
    totalAttempts += batch;

    for (const { salt, addr } of results) {
      if (addr) {
        console.log(
          `Vanity salt found after ${totalAttempts} attempts (batch size ${concurrency}) → token ${addr}`
        );
        return salt;
      }
    }

    if (
      totalAttempts === batch ||
      totalAttempts - lastProgressLog >= 25_000
    ) {
      lastProgressLog = totalAttempts;
      console.log(
        `Vanity mining… ${totalAttempts}/${maxAttempts} parallel=${concurrency} (want …${suffix})`
      );
    }
  }

  throw new Error(
    `Vanity salt not found after ${maxAttempts} attempts (suffix 0x${suffix}). ` +
      `Increase VANITY_SALT_MAX_ATTEMPTS or shorten VANITY_ADDRESS_SUFFIX; ` +
      `try VANITY_SALT_CONCURRENCY=64 and a fast BASE_RPC_URL. ` +
      (lastErr instanceof Error ? `Last error: ${lastErr.message}` : '')
  );
}

/** Sum of extension msg.value for gas / simulation (dev buy). */
function deploymentConfigExtensionMsgValue(
  input: DeployTokenArgs,
  platformFeeRecipient?: `0x${string}`,
  platformFeeBps?: number
): bigint {
  const cfg = buildDeploymentConfig(input, platformFeeRecipient, platformFeeBps);
  return cfg.extensionConfigs.reduce((sum, ext) => sum + ext.msgValue, 0n);
}

export async function deployTokenOnchain(
  publicClient: PublicClient,
  walletClient: WalletClient,
  input: DeployTokenArgs,
  platformFeeRecipient?: `0x${string}`,
  platformFeeBps?: number
): Promise<OnchainDeployResult> {
  const account = walletClient.account;
  if (!account) throw new Error('WalletClient has no account');

  let deployInput: DeployTokenArgs = input;
  const vanityRaw = process.env.VANITY_ADDRESS_SUFFIX?.trim();
  if (vanityRaw) {
    if (input.salt) {
      throw new Error(
        'Do not set salt manually when VANITY_ADDRESS_SUFFIX is enabled (salt is mined).'
      );
    }
    const suffix = normalizeVanitySuffix(vanityRaw);
    const mined = await mineVanitySalt(
      publicClient,
      account.address,
      input,
      platformFeeRecipient,
      platformFeeBps,
      suffix
    );
    deployInput = { ...input, salt: mined };
  }

  const deploymentConfig = buildDeploymentConfig(
    deployInput,
    platformFeeRecipient,
    platformFeeBps
  );

  const msgValue = deploymentConfig.extensionConfigs.reduce(
    (sum, ext) => sum + ext.msgValue,
    0n
  );

  const hash = await walletClient.writeContract({
    chain: robinhood,
    account,
    address: input.factory,
    abi: LIQUID_FACTORY_ABI,
    functionName: 'deployToken',
    args: [deploymentConfig],
    value: msgValue,
    ...(msgValue > 0n ? { gas: deployTokenGasLimitWithValue() } : {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 180_000,
  });

  if (receipt.status !== 'success') {
    throw new Error(
      `deployToken transaction reverted: ${hash} (see BaseScan — often out-of-gas when gasUsed hits the cap; try DEPLOY_TOKEN_GAS)`
    );
  }

  const factoryHex = input.factory.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== factoryHex) continue;
    try {
      const decoded = decodeEventLog({
        abi: LIQUID_FACTORY_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== 'TokenCreated') continue;
      const args = decoded.args as {
        tokenAddress: `0x${string}`;
        poolId: `0x${string}`;
      };
      return {
        tokenAddress: getAddress(args.tokenAddress),
        poolId: args.poolId,
        transactionHash: hash,
        blockNumber: receipt.blockNumber,
      };
    } catch {
      continue;
    }
  }

  throw new Error(
    `TokenCreated event not found in receipt for transaction ${hash}`
  );
}
