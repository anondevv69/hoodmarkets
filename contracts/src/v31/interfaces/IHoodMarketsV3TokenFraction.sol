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

    function FRACTION_COUNT() external view returns (uint256);
    function FRACTION_TOKEN_ID() external view returns (uint256);
    function launchToken() external view returns (address);
    function tokensPerFraction() external view returns (uint256);

    /// @notice Burn fractional shares and receive the underlying launch token.
    function redeem(uint256 amount) external;
}
