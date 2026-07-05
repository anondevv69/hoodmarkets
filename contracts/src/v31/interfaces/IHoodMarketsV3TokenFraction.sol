// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IHoodMarketsV3TokenFraction {
    /// @notice When a caller is not the HoodMarkets V3 factory
    error InvalidFactory();
    /// @notice When redeeming more shares than the caller holds
    error InsufficientFractionBalance();
    /// @notice When redeem amount is zero
    error ZeroRedeemAmount();
    error InvalidBuyerRewardShareCount();
    error BuyerRewardPoolExhausted();
    error BuyerShareAlreadyIssued();
    error InvalidBuyer();
    error NothingToClaim();
    error InvalidListing();
    error ListingInactive();
    error InvalidListAmount();
    error InvalidListPrice();
    error WrongPayment();

    struct ShareListing {
        address seller;
        uint256 shareAmount;
        address paymentToken;
        uint256 price;
        bool active;
    }

    event FractionRedeemed(
        address indexed owner, uint256 indexed id, uint256 amount, uint256 underlyingAmount
    );

    event TradingFeesClaimed(
        address indexed holder,
        address indexed token0,
        uint256 amount0,
        address indexed token1,
        uint256 amount1
    );

    event TradingFeesDistributed(
        address indexed triggeredBy,
        uint256 holderCount,
        uint256 totalAmount0,
        uint256 totalAmount1
    );

    event BuyerShareIssued(address indexed buyer, uint256 sharesRemaining);

    event SharesListed(
        uint256 indexed listingId,
        address indexed seller,
        uint256 shareAmount,
        address paymentToken,
        uint256 price
    );

    event SharesListingCancelled(uint256 indexed listingId, address indexed seller, uint256 shareAmount);

    event SharesSold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 shareAmount,
        address paymentToken,
        uint256 price
    );

    function FRACTION_COUNT() external view returns (uint256);
    function FRACTION_TOKEN_ID() external view returns (uint256);
    function launchToken() external view returns (address);
    function tokensPerFraction() external view returns (uint256);
    function outstandingShares() external view returns (uint256);
    function positionId() external view returns (uint256);
    function rewardToken0() external view returns (address);
    function rewardToken1() external view returns (address);
    function pool() external view returns (address);
    function buyerRewardAdmin() external view returns (address);
    function buyerRewardShareCap() external view returns (uint256);
    function buyerRewardSharesRemaining() external view returns (uint256);
    function buyerShareIssued(address buyer) external view returns (bool);

    /// @notice Burn fractional shares and receive the underlying launch token.
    function redeem(uint256 amount) external;

    /// @notice Pull LP swap fees into this contract and pay every share holder their pro-rata slice (one tx).
    function claimTradingFees() external;

    /// @notice Number of wallets with a non-zero share balance.
    function shareHolderCount() external view returns (uint256);

    /// @notice Share holder address at `index` (for off-chain enumeration).
    function shareHolderAt(uint256 index) external view returns (address);

    /// @notice View unclaimed trading fees for a share holder.
    function pendingTradingFees(address account) external view returns (uint256, uint256);

    /// @notice Wire pool reward tokens after launch (factory-only, once).
    function configureFeeRewards(
        uint256 positionId,
        address rewardToken0,
        address rewardToken1,
        address pool_
    ) external;

    /// @notice Transfer one buyer-reward share from the escrow pool (factory relay or fee admin).
    function issueBuyerShare(address buyer) external;

    /// @notice Next listing id (listings are `1 … nextListingId - 1`).
    function nextListingId() external view returns (uint256);

    function listings(uint256 listingId)
        external
        view
        returns (address seller, uint256 shareAmount, address paymentToken, uint256 price, bool active);

    /// @notice Escrow shares and list them for sale. `paymentToken` = address(0) for native ETH.
    function listShares(uint256 shareAmount, address paymentToken, uint256 price)
        external
        returns (uint256 listingId);

    /// @notice Buy a listing — payment goes to seller, shares go to buyer (one tx).
    function buyShares(uint256 listingId) external payable;

    /// @notice Cancel a listing and return escrowed shares to the seller.
    function cancelListing(uint256 listingId) external;
}
