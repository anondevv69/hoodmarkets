import { createWalletClient, custom } from 'viem';
import { LiquidFactoryAbi } from 'liquid-sdk';
import { robinhood } from '../chain';
import { deserializeDeploymentConfig, type SerializedDeploymentConfig } from './deploymentConfigJson';
import { HOODMARKETS_V3_ABI } from './hoodmarketsV3Abi';
import {
  deserializeV3DeploymentConfig,
  type SerializedV3DeploymentConfig,
} from './v3DeploymentConfigJson';

export function assertV3WalletDeployPrepare(prepare: WalletDeployPrepare): void {
  if (prepare.factoryKind !== 'hoodmarkets-v3') return;
  if (prepare.deploymentConfig.fractionConfig == null) {
    throw new Error(
      'Launch config is outdated (missing v0.6 fractionConfig). Hard-refresh hood.markets and launch again — do not finalize an old attempt.',
    );
  }
}

export type WalletDeployPrepare =
  | {
      mode: 'wallet';
      factoryKind: 'hoodmarkets-v3';
      factory: `0x${string}`;
      deploymentConfig: SerializedV3DeploymentConfig;
      msgValueWei: string;
      gas: string;
      chainId: number;
      imageUrl: string;
    }
  | {
      mode: 'wallet';
      factoryKind: 'liquid-v4';
      factory: `0x${string}`;
      deploymentConfig: SerializedDeploymentConfig;
      msgValueWei: string;
      gas: string;
      chainId: number;
      imageUrl: string;
    };

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export async function signWalletDeployToken(opts: {
  prepare: WalletDeployPrepare;
  walletProvider: EthereumProvider;
  account: `0x${string}`;
}): Promise<`0x${string}`> {
  const client = createWalletClient({
    account: opts.account,
    chain: robinhood,
    transport: custom(opts.walletProvider),
  });

  if (opts.prepare.factoryKind === 'hoodmarkets-v3') {
    assertV3WalletDeployPrepare(opts.prepare);
    const deploymentConfig = deserializeV3DeploymentConfig(opts.prepare.deploymentConfig);
    return client.writeContract({
      address: opts.prepare.factory,
      abi: HOODMARKETS_V3_ABI,
      functionName: 'deployToken',
      args: [deploymentConfig],
      value: BigInt(opts.prepare.msgValueWei),
      gas: BigInt(opts.prepare.gas),
    });
  }

  const deploymentConfig = deserializeDeploymentConfig(opts.prepare.deploymentConfig);
  return client.writeContract({
    address: opts.prepare.factory,
    abi: LiquidFactoryAbi,
    functionName: 'deployToken',
    args: [deploymentConfig],
    value: BigInt(opts.prepare.msgValueWei),
    gas: BigInt(opts.prepare.gas),
  });
}
