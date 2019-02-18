pragma solidity ^0.4.23;

contract Checkable {
  /**
   * Flag means that contract accident already occurs.
   */
  bool public triggered = false;

  /**
   * Occurs when accident happened.
   */
  event Triggered(uint balance);
  /**
   * Occurs when check finished.
   * isAccident is accident occurred
   */
  event Checked(bool isAccident);

  /**
   * Public check method.
   */
  function check() public payable notTriggered {
    if (internalCheck()) {
      emit Triggered(address(this).balance);
      triggered = true;
      internalAction();
    }
  }

  /**
   * @dev Do inner check.
   * @return bool true of accident triggered, false otherwise.
   */
  function internalCheck() internal returns (bool);

  /**
   * @dev Do inner action if check was success.
   */
  function internalAction() internal;

  modifier notTriggered {
    require(!triggered, "Already triggered");
    _;
  }
}
