// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/ElectionRegistry.sol";

contract ElectionRegistryTest is Test {
    ElectionRegistry public registry;
    address public admin;
    address public voter;
    address public authority;

    event ElectionCreated(string electionId, string electionName);
    event VoteSubmitted(string electionId, bytes32 ciphertextHash);

    string electionId = "election-2025";

    function setUp() public {
        admin = address(this);
        voter = address(0x123);
        authority = address(0x456);
        registry = new ElectionRegistry();
    }

    function test_CreateElection() public {
        string[] memory candidates = new string[](2);
        candidates[0] = "Alice";
        candidates[1] = "Bob";

        vm.expectEmit(true, false, false, true);
        emit ElectionCreated(electionId, "General Election");

        registry.createElection(
            electionId,
            "General Election",
            candidates,
            block.timestamp + 100,
            block.timestamp + 200,
            block.timestamp + 300
        );

        (string memory id, string memory name, , , , , , bool initialized, , ) = registry.elections(electionId);
        assertEq(id, electionId);
        assertEq(name, "General Election");
        assertTrue(initialized);
    }

    function test_FullVotingFlow() public {
        // 1. Create Election
        string[] memory candidates = new string[](2);
        candidates[0] = "Alice";
        candidates[1] = "Bob";
        registry.createElection(electionId, "General Election", candidates, block.timestamp, block.timestamp + 100, block.timestamp + 200);

        // 2. Register Authority
        address[] memory auths = new address[](1);
        auths[0] = authority;
        registry.registerAuthorities(electionId, auths);

        // 3. Submit Vote
        bytes32 ciphertextHash = keccak256(abi.encodePacked("ciphertext"));
        vm.expectEmit(true, false, false, true);
        emit VoteSubmitted(electionId, ciphertextHash);
        
        registry.submitVote(electionId, "ciphertext", ciphertextHash);
        
        // 4. Warp to end
        vm.warp(block.timestamp + 150);

        // 5. Publish Tally
        registry.publishEncryptedTally(electionId, "encryptedTally");

        // 6. Submit Partial Decryption (as Authority)
        vm.prank(authority);
        registry.submitPartialDecryption(electionId, "decryption");

        // 7. Publish Result
        registry.publishFinalResult(electionId, "Winner: Alice");
        
        (, , , , , , , , , bool resultPublished) = registry.elections(electionId);
        assertTrue(resultPublished);
    }
}
