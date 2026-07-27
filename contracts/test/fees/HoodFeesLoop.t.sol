// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {HoodFeeLock} from "../../src/fees/HoodFeeLock.sol";
import {HoodFeesRouter} from "../../src/fees/HoodFeesRouter.sol";
import {IWETH} from "../../src/fees/interfaces/IWETH.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("FEES", "FEES") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockWETH is ERC20, IWETH {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function deposit() external payable override {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external override {
        _burn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "ETH_TRANSFER");
    }

    receive() external payable {
        _mint(msg.sender, msg.value);
    }
}

contract MockFraction {
    bool public claimed;

    function claimTradingFees() external {
        claimed = true;
    }
}

contract HoodFeesLoopTest is Test {
    HoodFeeLock internal feeLock;
    HoodFeesRouter internal router;
    MockERC20 internal fees;
    MockWETH internal weth;
    MockFraction internal fraction;

    address internal owner = makeAddr("owner");
    address internal traders = makeAddr("traders");
    address internal lockNft = makeAddr("lockNft");
    address internal launcher = makeAddr("launcher");
    address internal deployTarget = makeAddr("deployTarget");

    function setUp() public {
        feeLock = new HoodFeeLock();
        weth = new MockWETH();
        fees = new MockERC20();
        fraction = new MockFraction();

        router = new HoodFeesRouter(
            owner, address(weth), address(feeLock), traders, lockNft, launcher
        );

        vm.prank(owner);
        router.setFeesToken(address(fees));

        vm.prank(owner);
        router.setFeesFraction(address(fraction));
    }

    function test_previewSplit_70_25_of_95() public view {
        (uint256 loopAmount, uint256 traderAmount) = router.previewSplit(95 ether);
        assertEq(loopAmount, 70 ether);
        assertEq(traderAmount, 25 ether);
    }

    function test_process_locksFeesAndUnwrapsWeth() public {
        fees.mint(address(router), 95 ether);
        vm.deal(address(this), 95 ether);
        weth.deposit{value: 95 ether}();
        weth.transfer(address(router), 95 ether);

        router.process();

        assertEq(fees.balanceOf(traders), 25 ether);
        assertEq(weth.balanceOf(traders), 25 ether);
        assertEq(router.launchEthAvailable(), 70 ether);
        assertEq(address(router).balance, 70 ether);

        assertEq(feeLock.balanceOf(lockNft), 1);
        HoodFeeLock.Lock memory lock_ = feeLock.getLock(1);
        assertEq(lock_.token, address(fees));
        assertEq(lock_.amount, 70 ether);
        assertEq(lock_.unlockTime, block.timestamp + feeLock.DEFAULT_LOCK_DURATION());
        assertFalse(feeLock.isUnlocked(1));
    }

    function test_claimAndProcess_callsFractionThenSplits() public {
        fees.mint(address(router), 95 ether);
        vm.deal(address(this), 95 ether);
        weth.deposit{value: 95 ether}();
        weth.transfer(address(router), 95 ether);

        router.claimAndProcess(address(0));

        assertTrue(fraction.claimed());
        assertEq(fees.balanceOf(traders), 25 ether);
        assertEq(router.launchEthAvailable(), 70 ether);
    }

    function test_fundLaunch_onlySpender() public {
        vm.deal(address(this), 10 ether);
        (bool ok,) = address(router).call{value: 10 ether}("");
        assertTrue(ok);
        assertEq(router.launchEthAvailable(), 10 ether);

        vm.prank(makeAddr("stranger"));
        vm.expectRevert(HoodFeesRouter.NotLaunchSpender.selector);
        router.fundLaunch(payable(deployTarget), 1 ether);

        uint256 beforeBal = deployTarget.balance;
        vm.prank(launcher);
        router.fundLaunch(payable(deployTarget), 3 ether);

        assertEq(deployTarget.balance, beforeBal + 3 ether);
        assertEq(router.launchEthAvailable(), 7 ether);
    }

    function test_feeLock_noEarlyWithdraw() public {
        fees.mint(address(this), 1 ether);
        fees.approve(address(feeLock), 1 ether);
        uint256 lockId = feeLock.depositDefault(address(fees), 1 ether);

        vm.expectRevert(HoodFeeLock.LockNotExpired.selector);
        feeLock.withdraw(lockId);

        vm.warp(block.timestamp + feeLock.DEFAULT_LOCK_DURATION());
        feeLock.withdraw(lockId);
        assertEq(fees.balanceOf(address(this)), 1 ether);
    }

    function test_rescueCannotPullCoreAssets() public {
        fees.mint(address(router), 1 ether);
        vm.prank(owner);
        vm.expectRevert(HoodFeesRouter.CannotRescueCoreAsset.selector);
        router.rescueToken(address(fees), owner, 1 ether);
    }
}
