pragma solidity ^0.4.23;

import "./LostKey.sol";

contract LostKeyNotify is LostKey {
  /**
   * Period of time (in seconds) without activity.
   */
  uint32 public noActivityPeriod;

  /**
   * Last active timestamp.
   */
  uint64 public lastActiveTs;

  /**
   * Occurs when user notify that he is available.
   */
  event Notified();

  constructor(address _owner, address[] _recipients, uint[] _percents, uint32 _noActivityPeriod)
    public
    LostKey(_owner, _recipients, _percents)
  {
    noActivityPeriod = _noActivityPeriod;
    lastActiveTs = uint64(block.timestamp);
  }

  function imAvailable() public onlyTarget notTriggered onlyAlive {
    lastActiveTs = uint64(block.timestamp);
    emit Notified();
  }

  function internalCheck() internal returns (bool) {
    require(block.timestamp >= lastActiveTs);
    // we do not need payable
    require(msg.value == 0, "Value should be zero");
    bool result = block.timestamp - lastActiveTs >= noActivityPeriod;
    emit Checked(result);
    return result;
  }
}
