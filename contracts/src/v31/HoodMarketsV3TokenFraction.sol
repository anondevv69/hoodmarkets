// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IHoodMarketsV3TokenFraction} from "./interfaces/IHoodMarketsV3TokenFraction.sol";

/// @notice Fixed 1000-share fractional vault for every HoodMarkets V3 launch.
/// @dev ERC-1155 edition (id #0, supply 1000) so deploy stays one tx without 1000 ERC-721 mints.
contract HoodMarketsV3TokenFraction is ERC1155, IHoodMarketsV3TokenFraction {
    using SafeERC20 for IERC20;

    uint256 public constant FRACTION_COUNT = 1000;
    uint256 public constant FRACTION_TOKEN_ID = 0;

    address public immutable hoodMarketsFactory;
    address public immutable fractionDeployer;
    address public immutable launchToken;
    uint256 public immutable tokensPerFraction;

    bool private _initialized;

    error AlreadyInitialized();
    error Unauthorized();

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

    /// @notice Mint all fractional shares after the vault tokens are on this contract.
    function initialize(address initialHolder, uint256 vaultAmount) external {
        if (msg.sender != fractionDeployer) revert Unauthorized();
        if (_initialized) revert AlreadyInitialized();
        if (IERC20(launchToken).balanceOf(address(this)) < vaultAmount) revert Unauthorized();
        _initialized = true;

        _mint(initialHolder, FRACTION_TOKEN_ID, FRACTION_COUNT, "");
    }

    /// @inheritdoc IHoodMarketsV3TokenFraction
    function redeem(uint256 amount) external {
        if (amount == 0) revert ZeroRedeemAmount();

        uint256 underlyingAmount = amount * tokensPerFraction;
        _burn(msg.sender, FRACTION_TOKEN_ID, amount);
        IERC20(launchToken).safeTransfer(msg.sender, underlyingAmount);

        emit FractionRedeemed(msg.sender, FRACTION_TOKEN_ID, amount, underlyingAmount);
    }
}
