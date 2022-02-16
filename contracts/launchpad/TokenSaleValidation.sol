// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library TokenSaleValidation {
  function nonZeroAddresses(address[] memory addresses)
    internal
    pure
    returns (bool)
  {
    for (uint256 i; i < addresses.length; ++i) {
      if (addresses[i] == address(0)) {
        return false;
      }
    }
    return true;
  }

  function validWhitelistPurchaseLevels(
    uint8[] memory whitelistPurchaseLevels,
    uint256 maxLevel
  ) internal pure returns (bool) {
    for (uint256 i; i < whitelistPurchaseLevels.length; ++i) {
      if (
        whitelistPurchaseLevels[i] == 0 || whitelistPurchaseLevels[i] > maxLevel
      ) {
        return false;
      }
    }
    return true;
  }

  function validPurchaseAmount(
    uint256[] memory purchaseLevels,
    uint8 levelIndex,
    uint256 amount
  ) internal pure returns (bool) {
    for (uint256 i; i <= levelIndex; ++i) {
      if (amount == purchaseLevels[i]) {
        return true;
      }
    }
    return false;
  }
}
