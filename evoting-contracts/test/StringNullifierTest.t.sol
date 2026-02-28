// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/ElectionRegistry.sol";

contract StringNullifierTest is Test {
    ElectionRegistry public registry;

    function setUp() public {
        registry = new ElectionRegistry();
        // create election
        registry.createElection("testElection", "Test Election", "Admin");
        
        // setup election
        string[] memory candidates = new string[](2);
        candidates[0] = "Alice";
        candidates[1] = "Bob";
        string[] memory authorities = new string[](2);
        authorities[0] = "Authority1";
        authorities[1] = "Authority2";
        
        registry.setupElection(
            "testElection",
            block.timestamp,
            block.timestamp + 100,
            block.timestamp + 200,
            2,
            candidates,
            authorities,
            bytes32(0)
        );
        
        // finalize setup

    }

    function testSubmitVoteWithStringNullifier() public {
        string memory electionId = "testElection";
        string memory nullifier = "user-123-nullifier-string";
        bytes memory encryptedVote = hex"deadbeef";
        bytes memory proof = hex"c0ffee";

        registry.submitVote(electionId, nullifier, encryptedVote, proof);

        // Verify nullifier used
        bool used = registry.nullifierUsed(electionId, nullifier);
        assertTrue(used, "Nullifier should be marked as used");

        // Verify stored data
        (bytes memory storedC, bytes memory storedP) = registry.getEncryptedVote(electionId, nullifier);
        assertEq(storedC, encryptedVote, "Ciphertext should match");
        assertEq(storedP, proof, "Proof should match");
    }

    function testDuplicateNullifierReverts() public {
        string memory electionId = "testElection";
        string memory nullifier = "user-123-nullifier-string";
        bytes memory encryptedVote = hex"deadbeef";
        bytes memory proof = hex"c0ffee";

        registry.submitVote(electionId, nullifier, encryptedVote, proof);

        vm.expectRevert("Nullifier used");
        registry.submitVote(electionId, nullifier, encryptedVote, proof);
    }
}
