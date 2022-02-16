// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "../launchpad/TokenSaleValidation.sol";

contract TokenSaleValidationImpl is Context {
  function nonZeroAddresses(address[] memory addresses)
    public
    pure
    returns (bool)
  {
    return TokenSaleValidation.nonZeroAddresses(addresses);
  }

  function validWhitelistPurchaseLevels(
    uint8[] memory whitelistPurchaseLevels,
    uint256 maxLevel
  ) public pure returns (bool) {
    return
      TokenSaleValidation.validWhitelistPurchaseLevels(
        whitelistPurchaseLevels,
        maxLevel
      );
  }

  function validPurchaseAmount(
    uint256[] memory purchaseLevels,
    uint8 levelIndex,
    uint256 amount
  ) public pure returns (bool) {
    return
      TokenSaleValidation.validPurchaseAmount(
        purchaseLevels,
        levelIndex,
        amount
      );
  }
}
