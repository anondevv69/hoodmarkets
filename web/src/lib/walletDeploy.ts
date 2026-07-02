import { createWalletClient, custom } from 'viem';
import { LiquidFactoryAbi } from 'liquid-sdk';
import { robinhood } from '../chain';
import { deserializeDeploymentConfig, type SerializedDeploymentConfig } from './deploymentConfigJson';

export type WalletDeployPrepare = {
  mode: 'wallet';
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
