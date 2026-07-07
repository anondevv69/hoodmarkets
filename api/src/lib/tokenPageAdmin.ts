import { getAddress } from 'viem';
import type { DeploymentCatalogRow } from './deploymentCatalog.js';
import { resolveDeployerWalletAddress } from './deploymentPartyEnrichment.js';
import { fetchTopShareHolder } from './tokenFractionHolders.js';

export type TokenPageAdminInfo = {
  adminWallet: string;
  adminRole: 'top_share_holder' | 'deployer' | 'fee_recipient';
  topShareHolder: string | null;
  topShareCount: number | null;
  deployerWallet: string | null;
  feeRecipientAddress: string;
};

export async function resolveTokenPageAdmin(row: DeploymentCatalogRow): Promise<TokenPageAdminInfo> {
  const feeRecipientAddress = getAddress(row.feeRecipientAddress);
  const deployerWallet = await resolveDeployerWalletAddress(row);

  let fromBlock = 0n;
  if (row.blockNumber?.trim()) {
    try {
      fromBlock = BigInt(row.blockNumber.trim());
    } catch {
      fromBlock = 0n;
    }
  }

  const top = await fetchTopShareHolder(row.tokenAddress, {
    fromBlock,
    factoryAddress: row.factoryAddress,
  });

  if (top && top.shares > 0) {
    return {
      adminWallet: top.address,
      adminRole: 'top_share_holder',
      topShareHolder: top.address,
      topShareCount: top.shares,
      deployerWallet,
      feeRecipientAddress,
    };
  }

  if (deployerWallet) {
    return {
      adminWallet: deployerWallet,
      adminRole: 'deployer',
      topShareHolder: null,
      topShareCount: null,
      deployerWallet,
      feeRecipientAddress,
    };
  }

  return {
    adminWallet: feeRecipientAddress,
    adminRole: 'fee_recipient',
    topShareHolder: null,
    topShareCount: null,
    deployerWallet: null,
    feeRecipientAddress,
  };
}

export function walletIsTokenPageAdmin(wallet: string, admin: TokenPageAdminInfo): boolean {
  try {
    return getAddress(wallet).toLowerCase() === getAddress(admin.adminWallet).toLowerCase();
  } catch {
    return false;
  }
}
