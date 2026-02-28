// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Faucet {
    address public owner;
    uint256 public constant FUND_AMOUNT = 1 ether;
    mapping(address => bool) public funded;

    event UserFunded(address indexed user, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function fundUser(address user) external onlyOwner {
        require(!funded[user], "User already funded");
        require(address(this).balance >= FUND_AMOUNT, "Insufficient faucet balance");

        funded[user] = true;
        (bool success, ) = user.call{value: FUND_AMOUNT}("");
        require(success, "Transfer failed");

        emit UserFunded(user, FUND_AMOUNT);
    }

    receive() external payable {}
}
