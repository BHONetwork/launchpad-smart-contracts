// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./TokenSaleValidation.sol";

contract TokenSale is Initializable, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // Emitted event for new investment
  event NewInvestment(
    address indexed investor,
    uint256 amount,
    uint256 totalSaleAmount
  );

  // Emitted event for token sale finalization (fund is transfered to admin wallet)
  event Finalized(address admin, uint256 amount);

  // Emitted event for emergency withdrawal (fund is transfered to admin wallet, token sale is inactivated)
  event EmergencyWithdrawal(address admin, uint256 amount);

  struct TimeFrame {
    uint64 startTime;
    uint64 endTime;
  }

  // Token sale name
  string public name;

  // Admin
  address public admin;

  // Hardcap
  uint256 public hardcap;

  // Whitelist sale time frame
  TimeFrame public whitelistSaleTimeFrame;

  // Purchase levels. Level indices start from 0, so index 0 will be level 1 and so on
  uint256[] public purchaseLevels;

  // The token address used to purchase, e.g. USDT, BUSD, etc.
  address public purchaseToken;

  // The token instance used to purchase, e.g. USDT, BUSD, etc.
  IERC20 private purchaseToken_;

  // Status
  enum Status {
    INACTIVE,
    ACTIVE
  }
  Status public status;

  // Total sale amount
  uint256 public totalSaleAmount;

  // Is hardcap reached?
  bool private hardcapReached;

  // Is finalized?
  bool private finalized;

  // Investor
  struct Investor {
    address investor;
    uint256 totalInvestment;
    uint8 whitelistPurchaseLevel; // Level starts from 1
  }

  // Mapping investor wallet address to investor instance
  mapping(address => Investor) public investors;

  // Investors' wallet address
  address[] public investorAddresses;

  // Next refund index
  uint256 public nextRefundIdx;

  // Refunded addresses
  mapping(address => bool) public refunded;

  // Only admin
  modifier onlyAdmin() {
    require(msg.sender == admin, "TokenSale: caller is not the admin");
    _;
  }

  // If token sale's status is ACTIVE
  modifier activeTokenSale() {
    require(status == Status.ACTIVE && !finalized, "TokenSale: inactive");
    _;
  }

  // Has sold out?
  modifier availableForPurchase() {
    require(!hardcapReached, "TokenSale: sold out");
    _;
  }

  // Check if investor is registered
  modifier registered() {
    require(
      investors[msg.sender].investor != address(0),
      "TokenSale: not registered"
    );
    _;
  }

  /// @notice Create a new token sale
  function initialize(
    address _owner,
    string calldata _name,
    address _admin,
    uint256 _hardcap,
    TimeFrame calldata _whitelistSaleTimeFrame,
    uint256[] calldata _purchaseLevels,
    address _purchaseToken
  ) public initializer {
    require(_admin != address(0), "TokenSale: admin address is zero");

    require(_hardcap > 0, "TokenSale: hardcap is zero");

    require(
      _whitelistSaleTimeFrame.startTime != 0 &&
        _whitelistSaleTimeFrame.endTime != 0 &&
        _whitelistSaleTimeFrame.startTime < _whitelistSaleTimeFrame.endTime,
      "TokenSale: invalid whitelist sale time frame"
    );

    require(_purchaseLevels.length != 0, "TokenSale: empty purchase levels");

    require(
      _purchaseToken != address(0),
      "TokenSale: purchase token address is zero"
    );

    name = _name;
    admin = _admin;
    hardcap = _hardcap;
    whitelistSaleTimeFrame = _whitelistSaleTimeFrame;
    purchaseLevels = _purchaseLevels;
    purchaseToken = _purchaseToken;
    purchaseToken_ = IERC20(purchaseToken);

    status = Status.ACTIVE;
    totalSaleAmount = 0;
    hardcapReached = false;

    _transferOwnership(_owner);
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() initializer {}

  /// @notice Configure token sale
  function configureTokenSale(
    uint256 _hardcap,
    TimeFrame calldata _whitelistSaleTimeFrame,
    uint256[] calldata _purchaseLevels,
    uint256 _status
  ) external onlyOwner {
    require(_hardcap > 0, "TokenSale: hardcap is zero");

    require(
      _whitelistSaleTimeFrame.startTime != 0 &&
        _whitelistSaleTimeFrame.endTime != 0 &&
        _whitelistSaleTimeFrame.startTime < _whitelistSaleTimeFrame.endTime,
      "TokenSale: invalid whitelist sale time frame"
    );

    require(_purchaseLevels.length != 0, "TokenSale: empty purchase levels");

    require(
      _status == uint256(Status.INACTIVE) || _status == uint256(Status.ACTIVE),
      "TokenSale: invalid status"
    );

    hardcap = _hardcap;
    whitelistSaleTimeFrame = _whitelistSaleTimeFrame;
    purchaseLevels = _purchaseLevels;
    status = Status(_status);
  }

  /// @notice Register (whitelist) investors
  /// @dev New data will override old ones only when sale has not started
  function registerInvestors(
    address[] calldata _investors,
    uint8[] calldata _whitelistPurchaseLevels
  ) external onlyOwner {
    require(
      _investors.length == _whitelistPurchaseLevels.length,
      "TokenSale: lengths do not match"
    );

    require(
      TokenSaleValidation.nonZeroAddresses(_investors),
      "TokenSale: investor address is zero"
    );

    require(
      TokenSaleValidation.validWhitelistPurchaseLevels(
        _whitelistPurchaseLevels,
        purchaseLevels.length
      ),
      "TokenSale: invalid whitelist purchase level"
    );

    bool hasSaleStarted = block.timestamp >= whitelistSaleTimeFrame.startTime;

    for (uint256 i; i < _investors.length; ++i) {
      bool investorExisted = investors[_investors[i]].investor != address(0);

      if (!investorExisted) {
        investorAddresses.push(_investors[i]);
      }

      if (!hasSaleStarted || !investorExisted) {
        investors[_investors[i]] = Investor(
          _investors[i],
          0,
          _whitelistPurchaseLevels[i]
        );
      }
    }
  }

  function investorCount() public view returns (uint256) {
    return investorAddresses.length;
  }

  /// @notice Purchase token in whitelist sale
  function purchaseTokenWhitelistSale(uint256 amount)
    external
    activeTokenSale
    availableForPurchase
    registered
  {
    require(
      block.timestamp >= whitelistSaleTimeFrame.startTime &&
        block.timestamp <= whitelistSaleTimeFrame.endTime,
      "TokenSale: not in whitelist sale time"
    );

    Investor storage investor = investors[msg.sender];

    require(
      TokenSaleValidation.validPurchaseAmount(
        purchaseLevels,
        investor.whitelistPurchaseLevel - 1,
        amount
      ),
      "TokenSale: invalid purchase amount"
    );

    uint256 purchaseCap = purchaseLevels[investor.whitelistPurchaseLevel - 1];

    require(
      investor.totalInvestment < purchaseCap,
      "TokenSale: exceed maximum investment"
    );

    uint256 investmentAmount = amount;

    if (investmentAmount > hardcap.sub(totalSaleAmount)) {
      investmentAmount = hardcap.sub(totalSaleAmount);
    }

    if (investmentAmount > purchaseCap.sub(investor.totalInvestment)) {
      investmentAmount = purchaseCap.sub(investor.totalInvestment);
    }

    totalSaleAmount = totalSaleAmount.add(investmentAmount);
    investor.totalInvestment = investor.totalInvestment.add(investmentAmount);

    if (totalSaleAmount >= hardcap) {
      hardcapReached = true;
    }

    purchaseToken_.safeTransferFrom(
      msg.sender,
      address(this),
      investmentAmount
    );
    emit NewInvestment(investor.investor, investmentAmount, totalSaleAmount);
  }

  /// @notice Finalize token sale: send all funds to admin's wallet
  function finalize() external onlyOwner {
    require(
      hardcapReached || block.timestamp > whitelistSaleTimeFrame.endTime,
      "TokenSale: can not finalize"
    );
    require(!finalized, "TokenSale: finalized");

    finalized = true;
    status = Status.INACTIVE;

    uint256 balance = purchaseToken_.balanceOf(address(this));
    purchaseToken_.safeTransfer(admin, balance);
    emit Finalized(admin, balance);
  }

  /// @notice Emergency withdrawal
  ///   1. Send all funds to admin's wallet
  ///   2. Inactivate token sale
  function emergencyWithdraw() external onlyAdmin {
    status = Status.INACTIVE;

    uint256 balance = purchaseToken_.balanceOf(address(this));
    purchaseToken_.safeTransfer(admin, balance);
    emit EmergencyWithdrawal(admin, balance);
  }

  /// @notice Change investor wallet address
  function changeInvestorWalletAddress(address _oldAddress, address _newAddress)
    external
    onlyAdmin
  {
    require(!finalized, "TokenSale: finalized");

    require(
      investors[_oldAddress].investor != address(0),
      "TokenSale: invalid old address"
    );

    require(_newAddress != address(0), "TokenSale: new address is zero");

    require(
      investors[_newAddress].investor == address(0),
      "TokenSale: new address is already taken"
    );

    // Change old mapping to have address(0), i.e. not registered
    Investor storage investor = investors[_oldAddress];
    investor.investor = address(0);

    // Clone old investor data to new one & update new wallet address
    investors[_newAddress] = investor;
    investors[_newAddress].investor = _newAddress;

    // Update investor addresses to replace old with new one
    for (uint256 i; i < investorAddresses.length; ++i) {
      if (investorAddresses[i] == _oldAddress) {
        investorAddresses[i] = _newAddress;
        break;
      }
    }
  }

  /// @notice Refund to all investors
  /// @dev think twice 1: can we stuck at a specific index and can not proceed refund for other remaining investors?
  ///         currently this is impossible because we update the index before doing the transfer
  /// @dev think twice 2: if we should keep track of refunded investor by: 1. reset investor.totalInvestment to 0, or 2. store a mapping
  function refundAll() external onlyAdmin {
    if (status != Status.INACTIVE) {
      status = Status.INACTIVE;
    }

    for (uint256 i = nextRefundIdx; i < investorAddresses.length; ++i) {
      nextRefundIdx++;
      uint256 totalInvestment = investors[investorAddresses[i]].totalInvestment;
      if (totalInvestment != 0 && !refunded[investorAddresses[i]]) {
        refunded[investorAddresses[i]] = true;
        purchaseToken_.safeTransfer(investorAddresses[i], totalInvestment);
      }
    }
  }

  /// @notice Query token sale data
  function tokenSaleData()
    external
    view
    returns (
      string memory name_,
      address admin_,
      uint256 hardcap_,
      TimeFrame memory whitelistSaleTimeFrame_,
      uint256[] memory purchaseLevels_,
      address purchaseTokenAddress_,
      Status status_,
      uint256 totalSaleAmount_
    )
  {
    return (
      name,
      admin,
      hardcap,
      whitelistSaleTimeFrame,
      purchaseLevels,
      purchaseToken,
      status,
      totalSaleAmount
    );
  }
}
