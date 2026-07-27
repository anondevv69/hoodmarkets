// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {HoodFeeLock} from "./HoodFeeLock.sol";
import {IWETH} from "./interfaces/IWETH.sol";

interface IHoodFeesClaimable {
    function claimTradingFees() external;
}

/// @title HoodFeesRouter
/// @notice One-time `$FEES` fee recipient for hood.markets.
///         Of the V3 **95% fee-recipient** bucket this contract receives:
///         - **70%** → loop (meme → HoodFeeLock ~100y, WETH → unwrap to ETH launch runway)
///         - **25%** → traders / holders rewards recipient
///         The separate locker **5% platform** cut stays on the normal platform wallet.
///
/// @dev Deploy once. Launch `$FEES` with this address as fee recipient / creator admin so
///      Holder NFT shares mint here. Anyone can `claimAndProcess(fraction)` on the `$FEES` page.
contract HoodFeesRouter is Ownable, ReentrancyGuard, IERC721Receiver, IERC1155Receiver {
    using SafeERC20 for IERC20;

    /// @dev Shares of the 95% fee-recipient bucket (70 + 25 = 95).
    uint256 public constant LOOP_SHARE = 70;
    uint256 public constant TRADER_SHARE = 25;
    uint256 public constant FEE_RECIPIENT_SHARE = 95;

    IWETH public immutable weth;
    HoodFeeLock public immutable feeLock;

    /// @notice `$FEES` ERC-20 (set once after the token is deployed).
    address public feesToken;

    /// @notice Receives the 25% trader/holder slice (WETH + `$FEES`).
    address public traderRewards;

    /// @notice Receives HoodFeeLock NFTs for century-locked `$FEES`.
    address public lockNftRecipient;

    /// @notice Authorized launcher that may spend unwrapped ETH for deploys.
    address public launchSpender;

    /// @notice Optional fraction collection for one-click claim+process.
    address public feesFraction;

    /// @notice ETH reserved / available for free launches (accounting helper; balance is source of truth).
    uint256 public launchEthAvailable;

    error ZeroAddress();
    error FeesTokenAlreadySet();
    error FeesTokenNotSet();
    error NotLaunchSpender();
    error InsufficientLaunchEth();
    error EthTransferFailed();
    error NothingToProcess();
    error InvalidShareSplit();
    error CannotRescueCoreAsset();

    event FeesTokenSet(address indexed feesToken);
    event FeesFractionSet(address indexed feesFraction);
    event TraderRewardsUpdated(address indexed previous, address indexed next);
    event LockNftRecipientUpdated(address indexed previous, address indexed next);
    event LaunchSpenderUpdated(address indexed previous, address indexed next);
    event FeesProcessed(
        uint256 feesLoopLocked,
        uint256 feesToTraders,
        uint256 wethUnwrappedForLoop,
        uint256 wethToTraders,
        uint256 lockId
    );
    event LaunchFunded(address indexed to, uint256 amount, address indexed spender);
    event NativeReceived(address indexed from, uint256 amount);

    constructor(
        address owner_,
        address weth_,
        address feeLock_,
        address traderRewards_,
        address lockNftRecipient_,
        address launchSpender_
    ) Ownable(owner_) {
        if (
            owner_ == address(0) || weth_ == address(0) || feeLock_ == address(0)
                || traderRewards_ == address(0) || lockNftRecipient_ == address(0)
                || launchSpender_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (LOOP_SHARE + TRADER_SHARE != FEE_RECIPIENT_SHARE) revert InvalidShareSplit();

        weth = IWETH(weth_);
        feeLock = HoodFeeLock(feeLock_);
        traderRewards = traderRewards_;
        lockNftRecipient = lockNftRecipient_;
        launchSpender = launchSpender_;
    }

    receive() external payable {
        launchEthAvailable += msg.value;
        emit NativeReceived(msg.sender, msg.value);
    }

    /// @notice Bind the `$FEES` token address once after launch.
    function setFeesToken(address feesToken_) external onlyOwner {
        if (feesToken_ == address(0)) revert ZeroAddress();
        if (feesToken != address(0)) revert FeesTokenAlreadySet();
        feesToken = feesToken_;
        emit FeesTokenSet(feesToken_);
    }

    /// @notice Optional: fraction collection used by `claimAndProcess()`.
    function setFeesFraction(address feesFraction_) external onlyOwner {
        if (feesFraction_ == address(0)) revert ZeroAddress();
        feesFraction = feesFraction_;
        emit FeesFractionSet(feesFraction_);
    }

    function setTraderRewards(address traderRewards_) external onlyOwner {
        if (traderRewards_ == address(0)) revert ZeroAddress();
        address previous = traderRewards;
        traderRewards = traderRewards_;
        emit TraderRewardsUpdated(previous, traderRewards_);
    }

    function setLockNftRecipient(address lockNftRecipient_) external onlyOwner {
        if (lockNftRecipient_ == address(0)) revert ZeroAddress();
        address previous = lockNftRecipient;
        lockNftRecipient = lockNftRecipient_;
        emit LockNftRecipientUpdated(previous, lockNftRecipient_);
    }

    function setLaunchSpender(address launchSpender_) external onlyOwner {
        if (launchSpender_ == address(0)) revert ZeroAddress();
        address previous = launchSpender;
        launchSpender = launchSpender_;
        emit LaunchSpenderUpdated(previous, launchSpender_);
    }

    /// @notice Claim `$FEES` trading fees then split/lock/unwrap.
    /// @dev Uses `feesFraction` if `fraction` is address(0).
    function claimAndProcess(address fraction) external nonReentrant {
        address target = fraction == address(0) ? feesFraction : fraction;
        if (target == address(0)) revert ZeroAddress();
        IHoodFeesClaimable(target).claimTradingFees();
        _process();
    }

    /// @notice Split balances already held by this router (after an external claim).
    function process() external nonReentrant {
        _process();
    }

    /// @notice Spend unwrapped ETH to fund a token launch (seed + gas via deployer EOA/contract).
    function fundLaunch(address payable to, uint256 amount) external nonReentrant {
        if (msg.sender != launchSpender && msg.sender != owner()) revert NotLaunchSpender();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > launchEthAvailable || amount > address(this).balance) {
            revert InsufficientLaunchEth();
        }

        launchEthAvailable -= amount;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();

        emit LaunchFunded(to, amount, msg.sender);
    }

    /// @notice Rescue non-`$FEES` / non-WETH ERC-20 dust. Cannot pull loop assets.
    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (token == feesToken || token == address(weth)) revert CannotRescueCoreAsset();
        IERC20(token).safeTransfer(to, amount);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @dev Required so Holder NFT (ERC-1155) shares can mint to this router at launch.
    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId
            || interfaceId == type(IERC721Receiver).interfaceId
            || interfaceId == type(IERC165).interfaceId;
    }

    function previewSplit(uint256 amount)
        external
        pure
        returns (uint256 loopAmount, uint256 traderAmount)
    {
        loopAmount = (amount * LOOP_SHARE) / FEE_RECIPIENT_SHARE;
        traderAmount = (amount * TRADER_SHARE) / FEE_RECIPIENT_SHARE;
    }

    function _process() internal {
        address token = feesToken;
        if (token == address(0)) revert FeesTokenNotSet();

        uint256 feesBal = IERC20(token).balanceOf(address(this));
        uint256 wethBal = weth.balanceOf(address(this));
        if (feesBal == 0 && wethBal == 0) revert NothingToProcess();

        uint256 feesLoop;
        uint256 feesTraders;
        uint256 wethLoop;
        uint256 wethTraders;
        uint256 lockId;

        if (feesBal > 0) {
            feesLoop = (feesBal * LOOP_SHARE) / FEE_RECIPIENT_SHARE;
            feesTraders = (feesBal * TRADER_SHARE) / FEE_RECIPIENT_SHARE;
            // Dust from rounding stays in router and is included next process().

            if (feesTraders > 0) {
                IERC20(token).safeTransfer(traderRewards, feesTraders);
            }

            if (feesLoop > 0) {
                IERC20(token).forceApprove(address(feeLock), feesLoop);
                lockId = feeLock.depositDefaultFor(token, feesLoop, lockNftRecipient);
            }
        }

        if (wethBal > 0) {
            wethLoop = (wethBal * LOOP_SHARE) / FEE_RECIPIENT_SHARE;
            wethTraders = (wethBal * TRADER_SHARE) / FEE_RECIPIENT_SHARE;

            if (wethTraders > 0) {
                IERC20(address(weth)).safeTransfer(traderRewards, wethTraders);
            }

            if (wethLoop > 0) {
                // `withdraw` sends ETH here; `receive()` credits `launchEthAvailable`.
                weth.withdraw(wethLoop);
            }
        }

        emit FeesProcessed(feesLoop, feesTraders, wethLoop, wethTraders, lockId);
    }
}
