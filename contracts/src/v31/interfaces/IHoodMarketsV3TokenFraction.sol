// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IHoodMarketsV3TokenFraction {
    /// @notice When a caller is not the HoodMarkets V3 factory
    error InvalidFactory();
    /// @notice When redeeming more shares than the caller holds
    error InsufficientFractionBalance();
    /// @notice When redeem amount is zero
    error ZeroRedeemAmount();

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

    function FRACTION_COUNT() external view returns (uint256);
    function FRACTION_TOKEN_ID() external view returns (uint256);
    function launchToken() external view returns (address);
    function tokensPerFraction() external view returns (uint256);
    function outstandingShares() external view returns (uint256);
    function positionId() external view returns (uint256);
    function rewardToken0() external view returns (address);
    function rewardToken1() external view returns (address);

    /// @notice Burn fractional shares and receive the underlying launch token.
    function redeem(uint256 amount) external;

    /// @notice Pull LP swap fees into this contract and claim the caller's pro-rata share.
    function claimTradingFees() external;

    /// @notice View unclaimed trading fees for a share holder.
    function pendingTradingFees(address account) external view returns (uint256, uint256);

    /// @notice Wire pool reward tokens after launch (factory-only, once).
    function configureFeeRewards(uint256 positionId, address rewardToken0, address rewardToken1)
        external;
}
