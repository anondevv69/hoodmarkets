/** JSON-safe HoodMarkets V3 deployment config (BigInts as decimal strings). */

export type SerializedV3DeploymentConfig = {
  tokenConfig: {
    name: string;
    symbol: string;
    salt: `0x${string}`;
    image: string;
    metadata: string;
    context: string;
    originatingChainId: string;
  };
  vaultConfig: {
    vaultPercentage: number;
    vaultDuration: string;
  };
  poolConfig: {
    pairedToken: `0x${string}`;
    tickIfToken0IsNewToken: number;
  };
  initialBuyConfig: {
    pairedTokenPoolFee: number;
    pairedTokenSwapAmountOutMinimum: string;
  };
  rewardsConfig: {
    creatorReward: string;
    creatorAdmin: `0x${string}`;
    creatorRewardRecipient: `0x${string}`;
    interfaceAdmin: `0x${string}`;
    interfaceRewardRecipient: `0x${string}`;
  };
  fractionConfig?: {
    buyerRewardShareCount: number;
  };
};

export function deserializeV3DeploymentConfig(raw: SerializedV3DeploymentConfig) {
  return {
    tokenConfig: {
      name: raw.tokenConfig.name,
      symbol: raw.tokenConfig.symbol,
      salt: raw.tokenConfig.salt,
      image: raw.tokenConfig.image,
      metadata: raw.tokenConfig.metadata,
      context: raw.tokenConfig.context,
      originatingChainId: BigInt(raw.tokenConfig.originatingChainId),
    },
    vaultConfig: {
      vaultPercentage: raw.vaultConfig.vaultPercentage,
      vaultDuration: BigInt(raw.vaultConfig.vaultDuration),
    },
    poolConfig: {
      pairedToken: raw.poolConfig.pairedToken,
      tickIfToken0IsNewToken: raw.poolConfig.tickIfToken0IsNewToken,
    },
    initialBuyConfig: {
      pairedTokenPoolFee: raw.initialBuyConfig.pairedTokenPoolFee,
      pairedTokenSwapAmountOutMinimum: BigInt(raw.initialBuyConfig.pairedTokenSwapAmountOutMinimum),
    },
    rewardsConfig: {
      creatorReward: BigInt(raw.rewardsConfig.creatorReward),
      creatorAdmin: raw.rewardsConfig.creatorAdmin,
      creatorRewardRecipient: raw.rewardsConfig.creatorRewardRecipient,
      interfaceAdmin: raw.rewardsConfig.interfaceAdmin,
      interfaceRewardRecipient: raw.rewardsConfig.interfaceRewardRecipient,
    },
    fractionConfig: {
      buyerRewardShareCount: raw.fractionConfig?.buyerRewardShareCount ?? 0,
    },
  } as const;
}
