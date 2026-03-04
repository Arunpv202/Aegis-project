// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IElectionRegistry {

    /* ===================== STRUCTS ===================== */

    struct Election {
        string electionId;
        string electionName;
        string creatorName;

        string[] candidateNames;

        uint256 startTime;
        uint256 endTime;
        uint256 resultTime;

        uint256 threshold;
        uint256 degree;

        bytes32 faceDatabaseHash;
        string registrationMerkleRoot;

        bytes electionPublicKey;

        bool initialized;
        bool setupDone;
        bool completed;
        bool round1Active;
        bool round2Active;
        bool finalizedDKG;
    }

    struct Authority {
        uint256 authorityId;     // ✅ changed from string
        string authorityName;

        bytes publicKey;
        bytes publicKeyProof;

        bool round1Done;
        bool round2Done;
        bool decryptionDone;
    }

    /* ===================== EVENTS ===================== */

    event ElectionCreated(
        string electionId,
        string electionName,
        string creatorName
    );

    event ElectionSetupCompleted(string electionId);

    event AuthorityAdded(
        string electionId,
        uint256 authorityId,      // ✅ updated
        uint256 authorityIndex
    );

    event DKGRound1Submitted(
        string electionId,
        uint256 authorityIndex
    );

    event DKGRound2Submitted(
        string electionId,
        uint256 authorityIndex
    );

    event ElectionPublicKeySet(string electionId);

    event VoteSubmitted(
        string electionId,
        string nullifier
    );

    event EncryptedTallyPublished(string electionId);

    event PartialDecryptionSubmitted(
        string electionId,
        uint256 authorityIndex
    );

    event FinalResultPublished(string electionId);

    event Round1Activated(string electionId);

    /* ===================== CORE ===================== */

    function createElection(
        string calldata electionId,
        string calldata electionName,
        string calldata creatorName
    ) external;

    function setupElection(
        string calldata electionId,
        uint256 startTime,
        uint256 endTime,
        uint256 resultTime,
        string[] calldata candidateNames,
        string[] calldata authorityNames
    ) external;

    function finalizeElectionSetup(
        string calldata electionId,
        uint256 polynomial_degree,
        string calldata registrationMerkleRoot,
        bytes32 faceDatabaseHash
    ) external;

    function setRound1Active(
        string calldata electionId
    ) external;

    function submitDKGRound1(
        string calldata electionId,
        uint256 authorityId,              // ✅ updated
        bytes calldata publicKey,
        bytes calldata publicKeyProof
    ) external;

    function setRound2Active(
        string calldata electionId
    ) external;

    function submitDKGRound2(
        string calldata electionId,
        uint256 authorityId,              // ✅ updated
        bytes[] calldata commitments
    ) external;

    function setElectionPublicKey(
        string calldata electionId,
        bytes calldata electionPublicKey
    ) external;

    function submitVote(
        string calldata electionId,
        string calldata nullifier,
        bytes32 encryptedVotehash
    ) external;

    function publishEncryptedTally(
        string calldata electionId,
        bytes[] calldata encryptedTally
    ) external;

    function submitPartialDecryption(
        string calldata electionId,
        uint256 authorityId,              // ✅ updated
        bytes32 partialdecryptionhash
    ) external;

    function publishFinalResult(
        string calldata electionId,
        uint256[] calldata finalCounts
    ) external;

    /* ===================== GETTERS ===================== */
    //get election by creator name

    function getElectionDetails(
        string calldata electionId
    ) external view returns (Election memory);

    function getAuthorities(
        string calldata electionId
    ) external view returns (Authority[] memory);

    function getAuthoritiesBasic(
        string calldata electionId
    )
        external
        view
        returns (
            uint256[] memory authorityIds,   // ✅ updated
            string[] memory authorityNames
        );

    function getCommitments(
        string calldata electionId,
        uint256 authorityId               // ✅ updated
    ) external view returns (bytes[] memory);

    function getAuthorityActivity(
        string calldata electionId,
        uint256 authorityId               // ✅ updated
    )
        external
        view
        returns (
            bytes memory publicKey,
            bool round1Done,
            bool round2Done,
            bool decryptionDone,
            bytes[] memory commitments
        );

    function getFinalResult(
        string calldata electionId
    )
        external
        view
        returns (
            string[] memory candidates,
            uint256[] memory counts
        );

    function getEncryptedTally(
        string calldata electionId
    )
        external
        view
        returns (bytes[] memory);
}