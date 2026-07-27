// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IHoodMarketsV3} from "../../src/v31/interfaces/IHoodMarketsV3.sol";

/// @notice Deploy a HoodMarkets V3 token with an explicit fee recipient (creatorAdmin).
contract LaunchWithFeeRecipient is Script {
    address constant FACTORY = 0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    int24 constant LAUNCH_TICK = -238_400;
    uint24 constant POOL_FEE = 10_000;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        string memory name_ = vm.envOr("TOKEN_NAME", string("looptestingdeploy"));
        string memory symbol_ = vm.envOr("TOKEN_SYMBOL", string("LOOPTEST2"));

        uint256 gasReserve = 0.0003 ether;
        uint256 bal = deployer.balance;
        require(bal > gasReserve, "insufficient ETH for gas");
        uint256 seed = bal - gasReserve;
        // Cap seed so we don't drain the wallet; keep deploy affordable
        if (seed > 0.004 ether) seed = 0.004 ether;

        console.log("Deployer (pays gas/seed):", deployer);
        console.log("Fee recipient (shares):", feeRecipient);
        console.log("Name:", name_);
        console.log("Symbol:", symbol_);
        console.log("Seed wei:", seed);

        bytes32 salt = keccak256(abi.encodePacked(name_, symbol_, feeRecipient, block.timestamp));

        IHoodMarketsV3.DeploymentConfig memory config = IHoodMarketsV3.DeploymentConfig({
            tokenConfig: IHoodMarketsV3.TokenConfig({
                name: name_,
                symbol: symbol_,
                salt: salt,
                image: "https://hood.markets/logo.png",
                metadata: '{"description":"looptestingdeploy fee recipient set explicitly"}',
                context: "looptestingdeploy",
                originatingChainId: 4663
            }),
            vaultConfig: IHoodMarketsV3.VaultConfig({vaultPercentage: 0, vaultDuration: 0}),
            poolConfig: IHoodMarketsV3.PoolConfig({
                pairedToken: WETH, tickIfToken0IsNewToken: LAUNCH_TICK
            }),
            initialBuyConfig: IHoodMarketsV3.InitialBuyConfig({
                pairedTokenPoolFee: POOL_FEE, pairedTokenSwapAmountOutMinimum: 0
            }),
            rewardsConfig: IHoodMarketsV3.RewardsConfig({
                creatorReward: 95,
                creatorAdmin: feeRecipient,
                creatorRewardRecipient: feeRecipient,
                interfaceAdmin: feeRecipient,
                interfaceRewardRecipient: address(0)
            }),
            fractionConfig: IHoodMarketsV3.FractionConfig({buyerRewardShareCount: 0})
        });

        vm.startBroadcast(deployerKey);
        (address token, uint256 positionId) = IHoodMarketsV3(FACTORY).deployToken{value: seed}(config);
        vm.stopBroadcast();

        address fraction = IHoodMarketsV3(FACTORY).fractionCollectionForToken(token);
        console.log("=== Deployed ===");
        console.log("Token:", token);
        console.log("PositionId:", positionId);
        console.log("Fraction:", fraction);
    }
}
