// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {HoodFeeLock} from "../../src/fees/HoodFeeLock.sol";
import {HoodFeesRouter} from "../../src/fees/HoodFeesRouter.sol";

/// @notice One-time deploy of the `$FEES` loop: HoodFeeLock + HoodFeesRouter.
/// @dev After this:
///      1. Launch `$FEES` via HoodMarkets V3 with fee recipient = HoodFeesRouter
///      2. router.setFeesToken($FEES)
///      3. router.setFeesFraction(fractionCollection)
///      4. Keep locker teamRecipient as the normal 5% platform wallet
contract DeployHoodFeesLoop is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address owner = vm.envOr("HOODMARKETS_OWNER", deployer);
        address weth = vm.envAddress("WETH");

        // 25% trader rewards destination (multisig / rewards contract / EOA).
        // Defaults to platform fee recipient so the loop can deploy before rewards UX exists.
        address traderRewards = vm.envOr(
            "HOOD_FEES_TRADER_REWARDS", vm.envAddress("HOODMARKETS_PLATFORM_FEE_RECIPIENT")
        );
        // Who holds the century-lock NFTs (usually same owner / treasury).
        address lockNftRecipient = vm.envOr("HOOD_FEES_LOCK_NFT_RECIPIENT", owner);
        // Who may call fundLaunch (API deployer / ops wallet).
        address launchSpender = vm.envOr("HOOD_FEES_LAUNCH_SPENDER", deployer);

        console.log("Broadcast deployer:", deployer);
        console.log("Owner:", owner);
        console.log("WETH:", weth);
        console.log("Trader rewards (25%):", traderRewards);
        console.log("Lock NFT recipient:", lockNftRecipient);
        console.log("Launch spender:", launchSpender);

        vm.startBroadcast(deployerKey);

        HoodFeeLock feeLock = new HoodFeeLock();
        HoodFeesRouter router = new HoodFeesRouter(
            owner, weth, address(feeLock), traderRewards, lockNftRecipient, launchSpender
        );

        vm.stopBroadcast();

        console.log("HoodFeeLock:", address(feeLock));
        console.log("HoodFeesRouter:", address(router));
        console.log("Next: launch $FEES with fee recipient = HoodFeesRouter, then setFeesToken + setFeesFraction");
    }
}
