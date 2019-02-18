pragma solidity ^0.4.23;

import "./LostKeyNotify.sol";

contract LostKeyMain is LostKeyNotify {
  constructor() public SoftDestruct(D_TARGET) {
    address[2] memory _recipients = [D_HEIRS];
    uint[2] memory _percents = [D_PERCENTS];

    require(_recipients.length == _percents.length, "The number of recipients must be equal to the number of percent");
    percents.length = _recipients.length;

    // check percents
    uint summaryPercent = 0;
    for (uint i = 0; i < _recipients.length; i++) {
      address recipient = _recipients[i];
      uint percent = _percents[i];

      require(recipient != address(0));
      summaryPercent += percent;
      percents[i] = RecipientPercent(recipient, uint8(percent));
    }
    require(summaryPercent == 100, "Sum of percents must be equal to 100");

    noActivityPeriod = D_PERIOD_SECONDS;
    lastActiveTs = uint64(block.timestamp);
  }
}
