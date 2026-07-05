// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IHoodMarketsV3} from "./interfaces/IHoodMarketsV3.sol";
import {IHoodMarketsV3TokenFraction} from "./interfaces/IHoodMarketsV3TokenFraction.sol";

/// @notice Fixed 1000-share fractional vault for every HoodMarkets V3 launch.
/// @dev ERC-1155 edition (id #0, supply 1000). Trading fees (95% creator slice) route here
///      and are claimed pro-rata by share holders via `claimTradingFees()`.
contract HoodMarketsV3TokenFraction is ERC1155, ERC1155Holder, IHoodMarketsV3TokenFraction {
    using SafeERC20 for IERC20;

    uint256 public constant FRACTION_COUNT = 1000;
    uint256 public constant FRACTION_TOKEN_ID = 0;
    uint256 private constant ACC_PRECISION = 1e18;

    address public immutable hoodMarketsFactory;
    address public immutable fractionDeployer;
    address public immutable launchToken;
    uint256 public immutable tokensPerFraction;

    uint256 public outstandingShares;
    uint256 public positionId;
    address public rewardToken0;
    address public rewardToken1;
    address public pool;

    address public buyerRewardAdmin;
    uint256 public buyerRewardShareCap;
    uint256 public buyerRewardSharesRemaining;

    bool private _initialized;
    bool private _feeRewardsConfigured;

    mapping(address => bool) public buyerShareIssued;

    /// @dev Reward accounting per ERC20 (excludes vaulted launch tokens).
    mapping(address => uint256) public accRewardPerShare;
    mapping(address => uint256) public rewardTokenAccounted;
    mapping(address => mapping(address => uint256)) public rewardDebt;

    error AlreadyInitialized();
    error Unauthorized();
    error FeeRewardsAlreadyConfigured();
    error FeeRewardsNotConfigured();
    error NothingToClaim();

    constructor(
        address hoodMarketsFactory_,
        address fractionDeployer_,
        address launchToken_,
        string memory uri_,
        uint256 vaultAmount_
    ) ERC1155(uri_) {
        if (fractionDeployer_ != msg.sender) revert InvalidFactory();

        hoodMarketsFactory = hoodMarketsFactory_;
        fractionDeployer = fractionDeployer_;
        launchToken = launchToken_;
        tokensPerFraction = vaultAmount_ / FRACTION_COUNT;
    }

    /// @notice Mint fractional shares; escrow `buyerRewardShareCount` for first buyers.
    function initialize(address initialHolder, uint256 vaultAmount, uint256 buyerRewardShareCount_)
        external
    {
        if (msg.sender != fractionDeployer) revert Unauthorized();
        if (_initialized) revert AlreadyInitialized();
        if (IERC20(launchToken).balanceOf(address(this)) < vaultAmount) revert Unauthorized();
        if (buyerRewardShareCount_ > FRACTION_COUNT) revert InvalidBuyerRewardShareCount();

        _initialized = true;
        outstandingShares = FRACTION_COUNT;
        buyerRewardAdmin = initialHolder;
        buyerRewardShareCap = buyerRewardShareCount_;
        buyerRewardSharesRemaining = buyerRewardShareCount_;

        uint256 holderShares = FRACTION_COUNT - buyerRewardShareCount_;
        if (holderShares > 0) {
            _mint(initialHolder, FRACTION_TOKEN_ID, holderShares, "");
            _syncRewardDebt(initialHolder);
        }
        if (buyerRewardShareCount_ > 0) {
            _mint(address(this), FRACTION_TOKEN_ID, buyerRewardShareCount_, "");
        }
    }

    /// @notice Called once by the factory after the Uniswap V3 pool is created.
    function configureFeeRewards(
        uint256 positionId_,
        address rewardToken0_,
        address rewardToken1_,
        address pool_
    ) external {
        if (msg.sender != hoodMarketsFactory) revert Unauthorized();
        if (_feeRewardsConfigured) revert FeeRewardsAlreadyConfigured();
        if (rewardToken0_ == address(0) || rewardToken1_ == address(0) || pool_ == address(0)) {
            revert Unauthorized();
        }

        positionId = positionId_;
        rewardToken0 = rewardToken0_;
        rewardToken1 = rewardToken1_;
        pool = pool_;
        _feeRewardsConfigured = true;
    }

    /// @inheritdoc IHoodMarketsV3TokenFraction
    function redeem(uint256 amount) external {
        if (amount == 0) revert ZeroRedeemAmount();

        _accrueAll();
        _syncRewardDebt(msg.sender);

        uint256 underlyingAmount = amount * tokensPerFraction;
        _burn(msg.sender, FRACTION_TOKEN_ID, amount);
        outstandingShares -= amount;
        IERC20(launchToken).safeTransfer(msg.sender, underlyingAmount);

        emit FractionRedeemed(msg.sender, FRACTION_TOKEN_ID, amount, underlyingAmount);
    }

    /// @notice Pull swap fees from the LP locker (if any), then pay the caller their pro-rata share.
    function claimTradingFees() external {
        if (!_feeRewardsConfigured) revert FeeRewardsNotConfigured();

        IHoodMarketsV3(hoodMarketsFactory).claimRewards(launchToken);
        _accrueAll();

        uint256 paid0 = _payoutRewardToken(msg.sender, rewardToken0);
        uint256 paid1 = _payoutRewardToken(msg.sender, rewardToken1);
        if (paid0 == 0 && paid1 == 0) revert NothingToClaim();

        emit TradingFeesClaimed(msg.sender, rewardToken0, paid0, rewardToken1, paid1);
    }

    /// @inheritdoc IHoodMarketsV3TokenFraction
    function issueBuyerShare(address buyer) external {
        if (buyer == address(0)) revert InvalidBuyer();
        if (msg.sender != hoodMarketsFactory && msg.sender != buyerRewardAdmin) revert Unauthorized();
        if (buyerShareIssued[buyer]) revert BuyerShareAlreadyIssued();
        if (buyerRewardSharesRemaining == 0) revert BuyerRewardPoolExhausted();

        buyerShareIssued[buyer] = true;
        buyerRewardSharesRemaining--;

        _accrueAll();
        _safeTransferFrom(address(this), buyer, FRACTION_TOKEN_ID, 1, "");
        _syncRewardDebt(buyer);

        emit BuyerShareIssued(buyer, buyerRewardSharesRemaining);
    }

    /// @notice View pending trading fees for a share holder (both pool reward tokens).
    function pendingTradingFees(address account)
        external
        view
        returns (uint256 pending0, uint256 pending1)
    {
        if (!_feeRewardsConfigured) return (0, 0);
        pending0 = _pendingWithUnaccounted(account, rewardToken0);
        pending1 = _pendingWithUnaccounted(account, rewardToken1);
    }

    function _payoutRewardToken(address account, address token) internal returns (uint256 amount) {
        amount = _pending(account, token);
        if (amount == 0) return 0;
        rewardDebt[account][token] += amount;
        IERC20(token).safeTransfer(account, amount);
    }

    function _pending(address account, address token) internal view returns (uint256) {
        uint256 shares = balanceOf(account, FRACTION_TOKEN_ID);
        uint256 accumulated = (shares * accRewardPerShare[token]) / ACC_PRECISION;
        uint256 debt = rewardDebt[account][token];
        return accumulated > debt ? accumulated - debt : 0;
    }

    function _pendingWithUnaccounted(address account, address token) internal view returns (uint256) {
        uint256 shares = balanceOf(account, FRACTION_TOKEN_ID);
        uint256 eligible = _feeEligibleShares();
        if (shares == 0 || eligible == 0) return 0;

        uint256 acc = accRewardPerShare[token];
        uint256 balance = _rewardableBalance(token);
        uint256 accounted = rewardTokenAccounted[token];
        if (balance > accounted) {
            acc += ((balance - accounted) * ACC_PRECISION) / eligible;
        }

        uint256 accumulated = (shares * acc) / ACC_PRECISION;
        uint256 debt = rewardDebt[account][token];
        return accumulated > debt ? accumulated - debt : 0;
    }

    function _rewardableBalance(address token) internal view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (token == launchToken) {
            uint256 vaultLocked = outstandingShares * tokensPerFraction;
            if (balance <= vaultLocked) return 0;
            return balance - vaultLocked;
        }
        return balance;
    }

    function _feeEligibleShares() internal view returns (uint256) {
        uint256 escrow = balanceOf(address(this), FRACTION_TOKEN_ID);
        return outstandingShares > escrow ? outstandingShares - escrow : 0;
    }

    function _accrue(address token) internal {
        if (token == address(0)) return;

        uint256 eligible = _feeEligibleShares();
        uint256 balance = _rewardableBalance(token);
        uint256 accounted = rewardTokenAccounted[token];
        if (balance <= accounted || eligible == 0) return;

        uint256 unrewarded = balance - accounted;
        accRewardPerShare[token] += (unrewarded * ACC_PRECISION) / eligible;
        rewardTokenAccounted[token] = balance;
    }

    function _accrueAll() internal {
        _accrue(rewardToken0);
        _accrue(rewardToken1);
    }

    function _syncRewardDebt(address account) internal {
        if (account == address(0)) return;
        uint256 shares = balanceOf(account, FRACTION_TOKEN_ID);
        rewardDebt[account][rewardToken0] = (shares * accRewardPerShare[rewardToken0]) / ACC_PRECISION;
        rewardDebt[account][rewardToken1] = (shares * accRewardPerShare[rewardToken1]) / ACC_PRECISION;
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        if (_feeRewardsConfigured && ids.length == 1 && ids[0] == FRACTION_TOKEN_ID) {
            _accrueAll();
        }

        super._update(from, to, ids, values);

        if (_feeRewardsConfigured && ids.length == 1 && ids[0] == FRACTION_TOKEN_ID) {
            if (from != address(0)) _syncRewardDebt(from);
            if (to != address(0)) _syncRewardDebt(to);
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, ERC1155Holder)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
