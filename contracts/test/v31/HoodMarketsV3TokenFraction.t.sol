// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {HoodMarketsV3TokenFraction} from "../../src/v31/HoodMarketsV3TokenFraction.sol";
import {IHoodMarketsV3TokenFraction} from "../../src/v31/interfaces/IHoodMarketsV3TokenFraction.sol";
import {HoodMarketsV3FractionDeployer} from "../../src/v31/HoodMarketsV3FractionDeployer.sol";

contract MockLaunchToken is ERC20 {
    constructor() ERC20("Mock", "MOCK") {
        _mint(msg.sender, 100_000_000_000_000_000_000_000_000_000);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockWeth is ERC20 {
    constructor() ERC20("WETH", "WETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockHoodFactory {
    function claimRewards(address) external pure {}
}

contract HoodMarketsV3TokenFractionTest is Test {
    MockLaunchToken internal token;
    MockWeth internal weth;
    HoodMarketsV3TokenFraction internal fraction;
    HoodMarketsV3FractionDeployer internal fractionDeployer;
    MockHoodFactory internal hoodFactory;

    address internal creator = makeAddr("creator");
    address internal buyer = makeAddr("buyer");
    address internal buyer2 = makeAddr("buyer2");
    address internal pool = makeAddr("pool");

    uint256 internal constant VAULT_AMOUNT = 10_000_000_000_000_000_000_000_000_000;
    uint256 internal constant BUYER_REWARD_COUNT = 300;

    function setUp() public {
        token = new MockLaunchToken();
        weth = new MockWeth();
        hoodFactory = new MockHoodFactory();
        fractionDeployer = new HoodMarketsV3FractionDeployer(address(hoodFactory));
        token.transfer(address(hoodFactory), VAULT_AMOUNT);

        vm.startPrank(address(hoodFactory));
        token.approve(address(fractionDeployer), VAULT_AMOUNT);
        address fractionAddr = fractionDeployer.deployFraction(
            address(token), creator, VAULT_AMOUNT, BUYER_REWARD_COUNT
        );
        vm.stopPrank();

        fraction = HoodMarketsV3TokenFraction(fractionAddr);

        vm.prank(address(hoodFactory));
        fraction.configureFeeRewards(1, address(weth), address(token), pool);
    }

    function test_initialize_splitsBuyerPoolAndCreatorShares() public view {
        assertEq(fraction.balanceOf(creator, 0), 1000 - BUYER_REWARD_COUNT);
        assertEq(fraction.balanceOf(address(fraction), 0), BUYER_REWARD_COUNT);
        assertEq(fraction.buyerRewardShareCap(), BUYER_REWARD_COUNT);
        assertEq(fraction.buyerRewardSharesRemaining(), BUYER_REWARD_COUNT);
        assertEq(token.balanceOf(address(fraction)), VAULT_AMOUNT);
    }

    function test_issueBuyerShare_fromFactory() public {
        vm.prank(address(hoodFactory));
        fraction.issueBuyerShare(buyer);

        assertEq(fraction.balanceOf(buyer, 0), 1);
        assertEq(fraction.balanceOf(address(fraction), 0), BUYER_REWARD_COUNT - 1);
        assertEq(fraction.buyerRewardSharesRemaining(), BUYER_REWARD_COUNT - 1);
        assertTrue(fraction.buyerShareIssued(buyer));
    }

    function test_issueBuyerShare_fromFeeAdmin() public {
        vm.prank(creator);
        fraction.issueBuyerShare(buyer);
        assertEq(fraction.balanceOf(buyer, 0), 1);
    }

    function test_revert_issueBuyerShareTwice() public {
        vm.startPrank(address(hoodFactory));
        fraction.issueBuyerShare(buyer);
        vm.expectRevert(IHoodMarketsV3TokenFraction.BuyerShareAlreadyIssued.selector);
        fraction.issueBuyerShare(buyer);
        vm.stopPrank();
    }

    function test_redeem_transfersUnderlyingAndBurnsShares() public {
        vm.prank(creator);
        fraction.redeem(1);

        assertEq(fraction.balanceOf(creator, 0), 1000 - BUYER_REWARD_COUNT - 1);
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

    function test_claimTradingFees_proRataByShares() public {
        weth.mint(address(fraction), 1 ether);

        vm.prank(creator);
        fraction.claimTradingFees();
        assertApproxEqAbs(weth.balanceOf(creator), 1 ether, 1);
    }

    function test_claimTradingFees_splitAfterTransfer_oneTxPaysAll() public {
        vm.prank(creator);
        fraction.safeTransferFrom(creator, buyer, 0, 250, "");

        weth.mint(address(fraction), 1 ether);

        vm.prank(buyer2);
        fraction.claimTradingFees();

        uint256 creatorExpected = uint256(1 ether) * 450 / 700;
        uint256 buyerExpected = uint256(1 ether) * 250 / 700;
        assertApproxEqAbs(weth.balanceOf(creator), creatorExpected, 2);
        assertApproxEqAbs(weth.balanceOf(buyer), buyerExpected, 2);
        assertLt(weth.balanceOf(address(fraction)), 10);
    }

    function test_claimTradingFees_revertWhenNothingToClaim() public {
        vm.expectRevert(IHoodMarketsV3TokenFraction.NothingToClaim.selector);
        vm.prank(creator);
        fraction.claimTradingFees();
    }

    function test_buyerShareHolder_claimsTradingFees() public {
        vm.prank(address(hoodFactory));
        fraction.issueBuyerShare(buyer);

        weth.mint(address(fraction), 1 ether);

        vm.prank(buyer);
        fraction.claimTradingFees();
        assertGt(weth.balanceOf(buyer), 0);
    }

    function test_listAndBuyShares_nativeEth() public {
        vm.prank(creator);
        fraction.safeTransferFrom(creator, buyer, 0, 100, "");

        vm.deal(buyer2, 1 ether);
        uint256 price = 0.05 ether;

        vm.prank(buyer);
        uint256 listingId = fraction.listShares(50, address(0), price);
        assertEq(listingId, 1);
        assertEq(fraction.balanceOf(buyer, 0), 50);
        assertEq(fraction.balanceOf(address(fraction), 0), BUYER_REWARD_COUNT + 50);

        uint256 sellerBefore = buyer.balance;
        vm.prank(buyer2);
        fraction.buyShares{value: price}(listingId);

        assertEq(buyer2.balance, 1 ether - price);
        assertEq(buyer.balance, sellerBefore + price);
        assertEq(fraction.balanceOf(buyer2, 0), 50);
        assertEq(fraction.balanceOf(address(fraction), 0), BUYER_REWARD_COUNT);
    }

    function test_cancelListing_returnsShares() public {
        vm.prank(creator);
        fraction.safeTransferFrom(creator, buyer, 0, 10, "");

        vm.prank(buyer);
        uint256 listingId = fraction.listShares(10, address(0), 1 ether);
        assertEq(fraction.balanceOf(buyer, 0), 0);

        vm.prank(buyer);
        fraction.cancelListing(listingId);
        assertEq(fraction.balanceOf(buyer, 0), 10);
    }

    function test_revert_buyShares_wrongPayment() public {
        vm.prank(creator);
        fraction.safeTransferFrom(creator, buyer, 0, 5, "");

        vm.prank(buyer);
        uint256 listingId = fraction.listShares(5, address(0), 1 ether);

        vm.deal(buyer2, 2 ether);
        vm.prank(buyer2);
        vm.expectRevert(IHoodMarketsV3TokenFraction.WrongPayment.selector);
        fraction.buyShares{value: 0.5 ether}(listingId);
    }
}
