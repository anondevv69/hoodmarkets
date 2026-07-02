// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {HoodMarketsToken} from "../HoodMarketsToken.sol";
import {ILiquid} from "../interfaces/ILiquid.sol";

/// @notice Liquid Token Launcher
library HoodMarketsDeployer {
    function deployToken(ILiquid.TokenConfig memory tokenConfig, uint256 supply)
        external
        returns (address tokenAddress)
    {
        HoodMarketsToken token = new HoodMarketsToken{
            salt: keccak256(abi.encode(tokenConfig.tokenAdmin, tokenConfig.salt))
        }(
            tokenConfig.name,
            tokenConfig.symbol,
            supply,
            tokenConfig.tokenAdmin,
            tokenConfig.image,
            tokenConfig.metadata,
            tokenConfig.context,
            tokenConfig.originatingChainId
        );
        tokenAddress = address(token);
    }
}
