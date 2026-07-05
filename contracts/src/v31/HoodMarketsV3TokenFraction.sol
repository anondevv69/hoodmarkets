// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IHoodMarketsV3} from "./interfaces/IHoodMarketsV3.sol";
import {IHoodMarketsV3TokenFraction} from "./interfaces/IHoodMarketsV3TokenFraction.sol";

/// @notice Fixed 1000-share fractional vault for every HoodMarkets V3 launch.
/// @dev ERC-1155 edition (id #0, supply 1000). Trading fees (95% creator slice) route here
///      and are distributed pro-rata to all share holders in one permissionless `claimTradingFees()`.
///      Shares can be listed and sold on-chain via `listShares` / `buyShares`.
contract HoodMarketsV3TokenFraction is ERC1155, ERC1155Holder, ReentrancyGuard, IHoodMarketsV3TokenFraction {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

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

    /// @dev Wallets with a non-zero share balance (excludes escrow on `address(this)`).
    EnumerableSet.AddressSet private _shareHolders;

    /// @dev Reward accounting per ERC20 (excludes vaulted launch tokens).
    mapping(address => uint256) public accRewardPerShare;
    mapping(address => uint256) public rewardTokenAccounted;
    mapping(address => mapping(address => uint256)) public rewardDebt;

    uint256 public nextListingId = 1;
    mapping(uint256 => ShareListing) public listings;

    error AlreadyInitialized();
    error Unauthorized();
    error FeeRewardsAlreadyConfigured();
    error FeeRewardsNotConfigured();

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
            _shareHolders.add(initialHolder);
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

    /// @dev Per-launch metadata for explorers/wallets (ERC-1155 `uri`).
    function uri(uint256 /* tokenId */) public view override returns (string memory) {
        return string(
            abi.encodePacked(
                "https://api.hood.markets/api/fraction-metadata/",
                Strings.toHexString(launchToken),
                ".json"
            )
        );
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

    /// @notice Pull swap fees from the LP locker (if any), then pay every share holder their pro-rata slice.
    /// @dev Permissionless — `msg.sender` pays gas; rewards go to all holders, not the caller.
    function claimTradingFees() external {
        if (!_feeRewardsConfigured) revert FeeRewardsNotConfigured();

        IHoodMarketsV3(hoodMarketsFactory).claimRewards(launchToken);
        _accrueAll();

        uint256 len = _shareHolders.length();
        uint256 totalPaid0;
        uint256 totalPaid1;
        for (uint256 i = 0; i < len; i++) {
            address holder = _shareHolders.at(i);
            uint256 paid0 = _payoutRewardToken(holder, rewardToken0);
            uint256 paid1 = _payoutRewardToken(holder, rewardToken1);
            if (paid0 > 0 || paid1 > 0) {
                emit TradingFeesClaimed(holder, rewardToken0, paid0, rewardToken1, paid1);
            }
            totalPaid0 += paid0;
            totalPaid1 += paid1;
        }

        if (totalPaid0 == 0 && totalPaid1 == 0) revert NothingToClaim();

        emit TradingFeesDistributed(msg.sender, len, totalPaid0, totalPaid1);
    }

    /// @inheritdoc IHoodMarketsV3TokenFraction
    function shareHolderCount() external view returns (uint256) {
        return _shareHolders.length();
    }

    /// @inheritdoc IHoodMarketsV3TokenFraction
    function shareHolderAt(uint256 index) external view returns (address) {
        return _shareHolders.at(index);
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

    /// @inheritdoc IHoodMarketsV3TokenFraction
    function listShares(uint256 shareAmount, address paymentToken, uint256 price)
        external
        nonReentrant
        returns (uint256 listingId)
    {
        if (shareAmount == 0) revert InvalidListAmount();
        if (price == 0) revert InvalidListPrice();
        if (balanceOf(msg.sender, FRACTION_TOKEN_ID) < shareAmount) revert InsufficientFractionBalance();

        _accrueAll();
        _syncRewardDebt(msg.sender);
        _safeTransferFrom(msg.sender, address(this), FRACTION_TOKEN_ID, shareAmount, "");

        listingId = nextListingId++;
        listings[listingId] = ShareListing({
            seller: msg.sender,
            shareAmount: shareAmount,
            paymentToken: paymentToken,
            price: price,
            active: true
        });

        emit SharesListed(listingId, msg.sender, shareAmount, paymentToken, price);
    }

    /// @inheritdoc IHoodMarketsV3TokenFraction
    function buyShares(uint256 listingId) external payable nonReentrant {
        ShareListing storage listing = listings[listingId];
        if (listing.seller == address(0)) revert InvalidListing();
        if (!listing.active) revert ListingInactive();

        address seller = listing.seller;
        uint256 shareAmount = listing.shareAmount;
        address paymentToken = listing.paymentToken;
        uint256 price = listing.price;

        listing.active = false;

        if (paymentToken == address(0)) {
            if (msg.value != price) revert WrongPayment();
            (bool sent,) = seller.call{value: price}("");
            if (!sent) revert WrongPayment();
        } else {
            if (msg.value != 0) revert WrongPayment();
            IERC20(paymentToken).safeTransferFrom(msg.sender, seller, price);
        }

        _accrueAll();
        _safeTransferFrom(address(this), msg.sender, FRACTION_TOKEN_ID, shareAmount, "");
        _syncRewardDebt(msg.sender);

        emit SharesSold(listingId, msg.sender, seller, shareAmount, paymentToken, price);
    }

    /// @inheritdoc IHoodMarketsV3TokenFraction
    function cancelListing(uint256 listingId) external nonReentrant {
        ShareListing storage listing = listings[listingId];
        if (listing.seller == address(0)) revert InvalidListing();
        if (!listing.active) revert ListingInactive();
        if (listing.seller != msg.sender) revert Unauthorized();

        uint256 shareAmount = listing.shareAmount;
        listing.active = false;

        _safeTransferFrom(address(this), msg.sender, FRACTION_TOKEN_ID, shareAmount, "");

        emit SharesListingCancelled(listingId, msg.sender, shareAmount);
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
            if (from != address(0)) {
                _syncRewardDebt(from);
                _syncShareHolderRegistry(from);
            }
            if (to != address(0)) {
                _syncRewardDebt(to);
                _syncShareHolderRegistry(to);
            }
        }
    }

    function _syncShareHolderRegistry(address account) internal {
        if (account == address(0) || account == address(this)) return;
        if (balanceOf(account, FRACTION_TOKEN_ID) > 0) {
            _shareHolders.add(account);
        } else {
            _shareHolders.remove(account);
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
