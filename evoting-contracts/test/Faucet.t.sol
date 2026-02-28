// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Faucet.sol";

contract FaucetTest is Test {
    Faucet public faucet;
    address public owner;
    address public user1;

    event UserFunded(address indexed user, uint256 amount);

    function setUp() public {
        owner = address(this);
        user1 = address(0x123);
        faucet = new Faucet();
        // Fund the faucet
        (bool success, ) = address(faucet).call{value: 10 ether}("");
        require(success, "Funding faucet failed");
    }

    function test_FundUser() public {
        uint256 startBalance = user1.balance;
        
        vm.expectEmit(true, false, false, true);
        emit UserFunded(user1, 1 ether);
        
        faucet.fundUser(user1);
        
        assertEq(user1.balance, startBalance + 1 ether);
        assertTrue(faucet.funded(user1));
    }

    function test_RevertIf_AlreadyFunded() public {
        faucet.fundUser(user1);
        vm.expectRevert("User already funded");
        faucet.fundUser(user1);
    }

    function test_RevertIf_NotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Only owner can call this function");
        faucet.fundUser(user1);
    }
}
