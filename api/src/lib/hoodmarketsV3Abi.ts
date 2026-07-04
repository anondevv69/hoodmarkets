export const HOODMARKETS_V3_ABI = [
  {
    "type": "function",
    "name": "deployToken",
    "inputs": [
      {
        "name": "deploymentConfig",
        "type": "tuple",
        "internalType": "struct IHoodMarketsV3.DeploymentConfig",
        "components": [
          {
            "name": "tokenConfig",
            "type": "tuple",
            "internalType": "struct IHoodMarketsV3.TokenConfig",
            "components": [
              {
                "name": "name",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "symbol",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "salt",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "image",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "metadata",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "context",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "originatingChainId",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          },
          {
            "name": "vaultConfig",
            "type": "tuple",
            "internalType": "struct IHoodMarketsV3.VaultConfig",
            "components": [
              {
                "name": "vaultPercentage",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "vaultDuration",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          },
          {
            "name": "poolConfig",
            "type": "tuple",
            "internalType": "struct IHoodMarketsV3.PoolConfig",
            "components": [
              {
                "name": "pairedToken",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "tickIfToken0IsNewToken",
                "type": "int24",
                "internalType": "int24"
              }
            ]
          },
          {
            "name": "initialBuyConfig",
            "type": "tuple",
            "internalType": "struct IHoodMarketsV3.InitialBuyConfig",
            "components": [
              {
                "name": "pairedTokenPoolFee",
                "type": "uint24",
                "internalType": "uint24"
              },
              {
                "name": "pairedTokenSwapAmountOutMinimum",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          },
          {
            "name": "rewardsConfig",
            "type": "tuple",
            "internalType": "struct IHoodMarketsV3.RewardsConfig",
            "components": [
              {
                "name": "creatorReward",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "creatorAdmin",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "creatorRewardRecipient",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "interfaceAdmin",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "interfaceRewardRecipient",
                "type": "address",
                "internalType": "address"
              }
            ]
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "tokenAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "positionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "event",
    "name": "TokenCreated",
    "inputs": [
      {
        "name": "tokenAddress",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "creatorAdmin",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "interfaceAdmin",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "creatorRewardRecipient",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "interfaceRewardRecipient",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "positionId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "name",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "symbol",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "startingTickIfToken0IsNewToken",
        "type": "int24",
        "indexed": false,
        "internalType": "int24"
      },
      {
        "name": "metadata",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "amountTokensBought",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "vaultDuration",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "vaultPercentage",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "fractionCollection",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "fractionVaultAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "msgSender",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  }
] as const;
