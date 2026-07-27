// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IHoodMarketsV3} from "../../src/v31/interfaces/IHoodMarketsV3.sol";
import {HoodFeesRouter} from "../../src/fees/HoodFeesRouter.sol";

/// @notice Test-launch a HoodMarkets V3 token with fee recipient = HoodFeesRouter,
///         then wire setFeesToken + setFeesFraction.
/// @dev Uses 0 ETH initial buy (gas only). Fund the deployer for a seeded launch later.
contract TestLaunchFeesToken is Script {
    address constant FACTORY = 0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant ROUTER = 0x721b1de3633D3436418efEfef13262032F813b66;

    int24 constant LAUNCH_TICK = -238_400; // matches api DEFAULT_LAUNCH_TICK
    uint24 constant POOL_FEE = 10_000; // 1%

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        string memory name_ = vm.envOr("TEST_FEES_NAME", string("Hood Fees Loop Test"));
        string memory symbol_ = vm.envOr("TEST_FEES_SYMBOL", string("FEESTEST"));

        bytes32 salt = keccak256(abi.encodePacked("hood-fees-loop-test", block.timestamp, deployer));

        IHoodMarketsV3.DeploymentConfig memory config = IHoodMarketsV3.DeploymentConfig({
            tokenConfig: IHoodMarketsV3.TokenConfig({
                name: name_,
                symbol: symbol_,
                salt: salt,
                image: "https://hood.markets/logo.png",
                metadata: '{"description":"Test token for HoodFeesRouter loop"}',
                context: "hood-fees-loop-test",
                originatingChainId: 4663
            }),
            vaultConfig: IHoodMarketsV3.VaultConfig({vaultPercentage: 0, vaultDuration: 0}),
            poolConfig: IHoodMarketsV3.PoolConfig({
                pairedToken: WETH,
                tickIfToken0IsNewToken: LAUNCH_TICK
            }),
            initialBuyConfig: IHoodMarketsV3.InitialBuyConfig({
                pairedTokenPoolFee: POOL_FEE,
                pairedTokenSwapAmountOutMinimum: 0
            }),
            rewardsConfig: IHoodMarketsV3.RewardsConfig({
                creatorReward: 95,
                // Shares + fee admin = router so 95% lands in the loop on claim
                creatorAdmin: ROUTER,
                creatorRewardRecipient: ROUTER,
                interfaceAdmin: ROUTER,
                interfaceRewardRecipient: address(0)
            }),
            fractionConfig: IHoodMarketsV3.FractionConfig({buyerRewardShareCount: 0})
        });

        console.log("Deployer:", deployer);
        console.log("Factory:", FACTORY);
        console.log("Fees router (fee recipient):", ROUTER);
        console.log("Symbol:", symbol_);
        console.log("ETH balance:", deployer.balance);

        vm.startBroadcast(deployerKey);

        (address token, uint256 positionId) = IHoodMarketsV3(FACTORY).deployToken{value: 0}(config);

        address fraction = IHoodMarketsV3(FACTORY).fractionCollectionForToken(token);

        HoodFeesRouter(payable(ROUTER)).setFeesToken(token);
        HoodFeesRouter(payable(ROUTER)).setFeesFraction(fraction);

        vm.stopBroadcast();

        console.log("=== Test launch OK ===");
        console.log("Token:", token);
        console.log("PositionId:", positionId);
        console.log("Fraction:", fraction);
        console.log("Router feesToken set + feesFraction set");
        console.log("Next: buy some token with ETH, then router.claimAndProcess(fraction)");
    }
}
