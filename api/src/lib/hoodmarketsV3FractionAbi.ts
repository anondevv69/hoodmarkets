/** Minimal fraction ABI for buyer-reward relay (avoids JSON ESM import issues in Node 20 prod). */
export const HOODMARKETS_V3_FRACTION_ABI = [
  {
    type: 'function',
    name: 'buyerRewardShareCap',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'buyerRewardSharesRemaining',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'launchToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'pool',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'buyerRewardAdmin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'buyerShareIssued',
    stateMutability: 'view',
    inputs: [{ name: 'buyer', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
