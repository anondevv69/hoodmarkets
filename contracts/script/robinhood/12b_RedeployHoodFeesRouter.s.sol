// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {HoodFeesRouter} from "../../src/fees/HoodFeesRouter.sol";

/// @notice Redeploy HoodFeesRouter only (keeps existing HoodFeeLock).
/// @dev Use after router fixes (e.g. ERC-1155 receiver for Holder NFT shares).
contract RedeployHoodFeesRouter is Script {
    address constant EXISTING_FEE_LOCK = 0x2f713ebAd4fa9630D0b3CE5bAf9570c020A5173D;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address owner = vm.envOr("HOODMARKETS_OWNER", deployer);
        address weth = vm.envAddress("WETH");
        address feeLock = vm.envOr("HOOD_FEE_LOCK", EXISTING_FEE_LOCK);
        address traderRewards = vm.envOr(
            "HOOD_FEES_TRADER_REWARDS", vm.envAddress("HOODMARKETS_PLATFORM_FEE_RECIPIENT")
        );
        address lockNftRecipient = vm.envOr("HOOD_FEES_LOCK_NFT_RECIPIENT", owner);
        address launchSpender = vm.envOr("HOOD_FEES_LAUNCH_SPENDER", deployer);

        console.log("Redeploying HoodFeesRouter");
        console.log("FeeLock:", feeLock);
        console.log("Trader rewards:", traderRewards);

        vm.startBroadcast(deployerKey);
        HoodFeesRouter router = new HoodFeesRouter(
            owner, weth, feeLock, traderRewards, lockNftRecipient, launchSpender
        );
        vm.stopBroadcast();

        console.log("HoodFeesRouter:", address(router));
    }
}
