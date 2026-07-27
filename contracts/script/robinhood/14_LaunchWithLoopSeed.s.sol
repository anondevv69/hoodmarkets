// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script, console} from "forge-std/Script.sol";
import {IHoodMarketsV3} from "src/v31/interfaces/IHoodMarketsV3.sol";

contract LaunchWithLoopSeed is Script {
    address constant FACTORY = 0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    int24 constant LAUNCH_TICK = -238_400;
    uint24 constant POOL_FEE = 10_000;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        uint256 seed = vm.envUint("LOOP_SEED_WEI");
        // leave ~0.0002 ETH for gas if balance is tight
        uint256 bal = deployer.balance;
        require(bal > seed, "balance <= seed");
        uint256 gasReserve = 0.00025 ether;
        if (bal < seed + gasReserve) {
            seed = bal > gasReserve ? bal - gasReserve : 0;
        }
        console.log("Deployer:", deployer);
        console.log("Seed wei:", seed);
        console.log("Balance:", bal);

        bytes32 salt = keccak256(abi.encodePacked("loop-funded-test", block.timestamp, deployer));
        IHoodMarketsV3.DeploymentConfig memory config = IHoodMarketsV3.DeploymentConfig({
            tokenConfig: IHoodMarketsV3.TokenConfig({
                name: "Loop Funded Test",
                symbol: "LOOPTEST",
                salt: salt,
                image: "https://hood.markets/logo.png",
                metadata: '{"description":"Deployed with ETH from HoodFeesRouter fundLaunch"}',
                context: "loop-funded-test",
                originatingChainId: 4663
            }),
            vaultConfig: IHoodMarketsV3.VaultConfig({vaultPercentage: 0, vaultDuration: 0}),
            poolConfig: IHoodMarketsV3.PoolConfig({pairedToken: WETH, tickIfToken0IsNewToken: LAUNCH_TICK}),
            initialBuyConfig: IHoodMarketsV3.InitialBuyConfig({pairedTokenPoolFee: POOL_FEE, pairedTokenSwapAmountOutMinimum: 0}),
            rewardsConfig: IHoodMarketsV3.RewardsConfig({
                creatorReward: 95,
                creatorAdmin: deployer,
                creatorRewardRecipient: deployer,
                interfaceAdmin: deployer,
                interfaceRewardRecipient: address(0)
            }),
            fractionConfig: IHoodMarketsV3.FractionConfig({buyerRewardShareCount: 0})
        });

        vm.startBroadcast(deployerKey);
        (address token, uint256 positionId) = IHoodMarketsV3(FACTORY).deployToken{value: seed}(config);
        vm.stopBroadcast();
        console.log("Token:", token);
        console.log("PositionId:", positionId);
        console.log("Fraction:", IHoodMarketsV3(FACTORY).fractionCollectionForToken(token));
    }
}
