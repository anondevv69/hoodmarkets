// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {HoodMarketsV3TokenFraction} from "../../src/v31/HoodMarketsV3TokenFraction.sol";
import {HoodMarketsV3FractionDeployer} from "../../src/v31/HoodMarketsV3FractionDeployer.sol";

contract MockLaunchToken is ERC20 {
    constructor() ERC20("Mock", "MOCK") {
        _mint(msg.sender, 100_000_000_000_000_000_000_000_000_000);
    }
}

contract HoodMarketsV3TokenFractionTest is Test {
    MockLaunchToken internal token;
    HoodMarketsV3TokenFraction internal fraction;
    HoodMarketsV3FractionDeployer internal fractionDeployer;

    address internal hoodFactory = makeAddr("hoodFactory");
    address internal creator = makeAddr("creator");
    address internal buyer = makeAddr("buyer");

    uint256 internal constant VAULT_AMOUNT = 10_000_000_000_000_000_000_000_000_000;

    function setUp() public {
        token = new MockLaunchToken();
        fractionDeployer = new HoodMarketsV3FractionDeployer(hoodFactory);
        token.transfer(hoodFactory, VAULT_AMOUNT);

        vm.startPrank(hoodFactory);
        token.approve(address(fractionDeployer), VAULT_AMOUNT);
        address fractionAddr = fractionDeployer.deployFraction(address(token), creator, VAULT_AMOUNT);
        vm.stopPrank();

        fraction = HoodMarketsV3TokenFraction(fractionAddr);
    }

    function test_initialize_mints1000SharesToCreator() public view {
        assertEq(fraction.balanceOf(creator, 0), 1000);
        assertEq(token.balanceOf(address(fraction)), VAULT_AMOUNT);
        assertEq(fraction.tokensPerFraction(), VAULT_AMOUNT / 1000);
    }

    function test_redeem_transfersUnderlyingAndBurnsShares() public {
        vm.prank(creator);
        fraction.redeem(1);

        assertEq(fraction.balanceOf(creator, 0), 999);
        assertEq(token.balanceOf(creator), VAULT_AMOUNT / 1000);
    }

    function test_transferThenRedeem() public {
        vm.prank(creator);
        fraction.safeTransferFrom(creator, buyer, 0, 250, "");

        assertEq(fraction.balanceOf(buyer, 0), 250);

        vm.prank(buyer);
        fraction.redeem(50);

        assertEq(fraction.balanceOf(buyer, 0), 200);
        assertEq(token.balanceOf(buyer), (VAULT_AMOUNT / 1000) * 50);
    }

    function test_revert_redeemWithoutBalance() public {
        vm.prank(buyer);
        vm.expectRevert();
        fraction.redeem(1);
    }

    function test_revert_initializeTwice() public {
        vm.prank(address(fractionDeployer));
        vm.expectRevert(HoodMarketsV3TokenFraction.AlreadyInitialized.selector);
        fraction.initialize(creator, VAULT_AMOUNT);
    }
}
