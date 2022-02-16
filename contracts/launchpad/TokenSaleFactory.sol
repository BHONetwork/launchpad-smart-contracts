// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./TokenSale.sol";

contract TokenSaleFactory {
  event TokenSaleCreated(
    address proxy,
    address implementation,
    address factory
  );

  function createTokenSale(
    address _tokenSaleImplementation,
    string calldata _name,
    address _admin,
    uint256 _hardcap,
    TokenSale.TimeFrame calldata _whitelistSaleTimeFrame,
    uint256[] calldata _purchaseLevels,
    address _purchaseToken
  ) public returns (address) {
    require(
      _tokenSaleImplementation != address(0),
      "TokenSaleFactory: implementation address is zero"
    );

    address proxy = Clones.clone(_tokenSaleImplementation);
    TokenSale(proxy).initialize(
      msg.sender,
      _name,
      _admin,
      _hardcap,
      _whitelistSaleTimeFrame,
      _purchaseLevels,
      _purchaseToken
    );

    emit TokenSaleCreated(proxy, _tokenSaleImplementation, address(this));

    return proxy;
  }
}
