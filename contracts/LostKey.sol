pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/math/Math.sol";
import "sc-library/contracts/ERC223/ERC223Receiver.sol";
import "sc-library/contracts/SoftDestruct.sol";
import "./Checkable.sol";

contract LostKey is Checkable, SoftDestruct, ERC223Receiver {
  using SafeMath for uint;

  struct RecipientPercent {
    address recipient;
    uint8 percent;
  }

  /**
   * Addresses of token contracts
   */
  address[] private tokenAddresses;

  /**
   * Recipient addresses and corresponding % of funds.
   */
  RecipientPercent[] public percents;

  // Occurs when contract was killed.
  event Killed(bool byUser);

  event TokensSent(address indexed token, address indexed recipient, uint amount, uint percent);

  event TokenAdded(address indexed token);

  function() public payable {
    require(false, "Fallback function not allowed");
  }

  function tokenFallback(address, uint, bytes) public {
    require(false, "Token fallback function not allowed");
  }

  /**
   * @dev Limit check execution only for alive contract.
   */
  function check() public payable onlyAlive {
    super.check();
  }

  /**
   * @dev Extends super method to add event producing.
   */
  function kill() public {
    super.kill();
    emit Killed(true);
  }

  /**
   * @dev Adds token addresses.
   *
   * @param _contracts Token contracts list to add.
   */
  function addTokenAddresses(address[] _contracts) external onlyTarget notTriggered onlyAlive {
    for (uint i = 0; i < _contracts.length; i++) {
      _addTokenAddress(_contracts[i]);
    }
  }

  /**
   * @dev Adds token address.
   *
   * @param _contract Token contract to add.
   */
  function addTokenAddress(address _contract) public onlyTarget notTriggered onlyAlive {
    _addTokenAddress(_contract);
  }

  function _addTokenAddress(address _contract) internal {
    require(_contract != address(0));
    //    require(!internalIsTokenAddressAlreadyInList(_contract));
    tokenAddresses.push(_contract);
    emit TokenAdded(_contract);
  }

  function isTokenInList(address _tokenContract) public view returns (bool) {
    for (uint i = 0; i < tokenAddresses.length; i++) {
      if (_tokenContract == tokenAddresses[i]) {
        return true;
      }
    }
    return false;
  }

  /**
   * @dev Calculate amounts to transfer corresponding to the percents.
   *
   * @param _balance current contract balance.
   */
  function _calculateAmounts(uint _balance) internal view returns (uint[] amounts) {
    uint remainder = _balance;
    amounts = new uint[](percents.length);
    for (uint i = 0; i < percents.length; i++) {
      if (i + 1 == percents.length) {
        amounts[i] = remainder;
        break;
      }
      uint amount = _balance.mul(percents[i].percent).div(100);
      amounts[i] = amount;
      remainder -= amount;
    }
  }

  /**
   * @dev Distribute tokens between recipients in corresponding by percents.
   */
  function _distributeTokens() internal {
    for (uint i = 0; i < tokenAddresses.length; i++) {
      ERC20 token = ERC20(tokenAddresses[i]);
      uint balance = token.balanceOf(targetUser);
      uint allowance = token.allowance(targetUser, this);
      uint[] memory amounts = _calculateAmounts(Math.min256(balance, allowance));

      for (uint j = 0; j < amounts.length; j++) {
        uint amount = amounts[j];
        address recipient = percents[j].recipient;
        uint percent = percents[j].percent;

        if (amount == 0) {
          continue;
        }

        token.transferFrom(targetUser, recipient, amount);
        emit TokensSent(token, recipient, amount, percent);
      }
    }
  }

  /**
   * @dev Do inner action if check was success.
   */
  function internalAction() internal {
    _distributeTokens();
  }

  function getTokenAddresses() public view returns (address[]) {
    return tokenAddresses;
  }
}
