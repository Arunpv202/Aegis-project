// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IElectionRegistry.sol";

contract ElectionRegistry is IElectionRegistry {

    /* ===================== STORAGE ===================== */

    mapping(string => Election) public elections;

    mapping(string => Authority[]) public electionAuthorities;
    mapping(string => mapping(uint256 => uint256)) public authorityIdToIndex;

    mapping(string => mapping(uint256 => bytes[])) public dkgCommitments;

    mapping(string => mapping(string => bytes32)) public encryptedVotehash;
    mapping(string => mapping(string => bool)) public nullifierUsed;

    mapping(string => bytes[]) public encryptedTallies;

    mapping(string => mapping(uint256 => bytes32)) public partialDecryptionhash;

    mapping(string => mapping(string => uint256)) public finalVoteCount;

    /* ===================== PHASE 1 ===================== */

    function createElection(
        string calldata electionId,
        string calldata electionName,
        string calldata creatorName
    ) external override {

        require(!elections[electionId].initialized, "Election exists");

        Election storage e = elections[electionId];
        e.electionId = electionId;
        e.electionName = electionName;
        e.creatorName = creatorName;
        e.initialized = true;

        electionAuthorities[electionId].push(
            Authority(1, creatorName, "", "", false, false, false)
        );

        authorityIdToIndex[electionId][1] = 0;

        emit ElectionCreated(electionId, electionName, creatorName);
        emit AuthorityAdded(electionId, 1, 0);
    }

    /* ===================== PHASE 2 ===================== */

    function setupElection(
        string calldata electionId,
        uint256 startTime,
        uint256 endTime,
        uint256 resultTime,
        string[] calldata candidateNames,
        string[] calldata authorityNames,
        bytes32 faceDatabaseHash
    ) external override {

        Election storage e = elections[electionId];
        require(e.initialized, "Election not found");
        require(!e.setupDone, "Already setup");

        e.startTime = startTime;
        e.endTime = endTime;
        e.resultTime = resultTime;
        e.faceDatabaseHash = faceDatabaseHash;

        for (uint i = 0; i < candidateNames.length; i++) {
            e.candidateNames.push(candidateNames[i]);
        }

        for (uint i = 0; i < authorityNames.length; i++) {

            uint256 id = i + 2;
            uint idx = electionAuthorities[electionId].length;

            electionAuthorities[electionId].push(
                Authority(id, authorityNames[i], "", "", false, false, false)
            );

            authorityIdToIndex[electionId][id] = idx;

            emit AuthorityAdded(electionId, id, idx);
        }

        emit ElectionSetupCompleted(electionId);
    }

    function finalizeElectionSetup(
        string calldata electionId,
        uint256 polynomial_degree,
        string calldata registrationMerkleRoot
    ) external override {

        Election storage e = elections[electionId];
        require(!e.setupDone, "Election not setup");

        e.degree = polynomial_degree;
        e.threshold = polynomial_degree + 1;
        e.registrationMerkleRoot = registrationMerkleRoot;
        e.setupDone = true;

        emit ElectionSetupCompleted(electionId);
    }

    /* ===================== DKG ROUND 1 ===================== */

    function setRound1Active(string calldata electionId) external override {
        Election storage e = elections[electionId];
        require(e.setupDone, "Election not setup");
        e.round1Active = true;
        emit Round1Activated(electionId);
    }

    function submitDKGRound1(
        string calldata electionId,
        uint256 authorityId,
        bytes calldata publicKey,
        bytes calldata publicKeyProof
    ) external override {

        uint idx = authorityIdToIndex[electionId][authorityId];
        Authority storage a = electionAuthorities[electionId][idx];

        require(!a.round1Done, "Round1 already done");

        a.publicKey = publicKey;
        a.publicKeyProof = publicKeyProof;
        a.round1Done = true;

        emit DKGRound1Submitted(electionId, idx);
    }

    /* ===================== DKG ROUND 2 ===================== */

    function setRound2Active(string calldata electionId) external override {
        Election storage e = elections[electionId];
        require(e.initialized, "Election not found");
        require(e.round1Active, "Round1 still active");
        e.round2Active = true;
    }

    function submitDKGRound2(
        string calldata electionId,
        uint256 authorityId,
        bytes[] calldata commitments
    ) external override {

        uint idx = authorityIdToIndex[electionId][authorityId];
        Authority storage a = electionAuthorities[electionId][idx];

        require(a.round1Done, "Round1 not done");
        require(!a.round2Done, "Round2 already done");

        dkgCommitments[electionId][idx] = commitments;
        a.round2Done = true;

        emit DKGRound2Submitted(electionId, idx);
    }

    /* ===================== VOTING ===================== */

    function setElectionPublicKey(
        string calldata electionId,
        bytes calldata electionPublicKey
    ) external override {
        elections[electionId].electionPublicKey = electionPublicKey;
        emit ElectionPublicKeySet(electionId);
    }

    function submitVote(
        string calldata electionId,
        string calldata nullifier,
        bytes32 encryptedVotehashes
    ) external override {

        require(!nullifierUsed[electionId][nullifier], "Nullifier used");

        nullifierUsed[electionId][nullifier] = true;
        encryptedVotehash[electionId][nullifier] = encryptedVotehashes;

        emit VoteSubmitted(electionId, nullifier);
    }

    /* ===================== TALLY ===================== */

    function publishEncryptedTally(
        string calldata electionId,
        bytes[] calldata encryptedTally
    ) external override {
        encryptedTallies[electionId] = encryptedTally;
        emit EncryptedTallyPublished(electionId);
    }

    function submitPartialDecryption(
        string calldata electionId,
        uint256 authorityId,
        bytes32 partialdecryptionhash
    ) external override {

        uint idx = authorityIdToIndex[electionId][authorityId];
        Authority storage a = electionAuthorities[electionId][idx];

        require(!a.decryptionDone, "Decryption already submitted");

        partialDecryptionhash[electionId][idx] = partialdecryptionhash;
        a.decryptionDone = true;

        emit PartialDecryptionSubmitted(electionId, idx);
    }

    function publishFinalResult(
        string calldata electionId,
        uint256[] calldata finalCounts
    ) external override {

        Election storage e = elections[electionId];
        require(finalCounts.length == e.candidateNames.length, "Length mismatch");

        for (uint i = 0; i < finalCounts.length; i++) {
            finalVoteCount[electionId][e.candidateNames[i]] = finalCounts[i];
        }

        e.completed = true;
        emit FinalResultPublished(electionId);
    }

    /* ===================== GETTERS ===================== */


    function getElectionDetails(
        string calldata electionId
    ) external view override returns (Election memory) {
        return elections[electionId];
    }

    function getAuthorities(
        string calldata electionId
    ) external view override returns (Authority[] memory) {
        return electionAuthorities[electionId];
    }

    function getAuthoritiesBasic(
        string calldata electionId
    )
        external
        view
        override
        returns (uint256[] memory authorityIds, string[] memory authorityNames)
    {
        Authority[] storage auths = electionAuthorities[electionId];
        uint len = auths.length;

        authorityIds = new uint256[](len);
        authorityNames = new string[](len);

        for (uint i = 0; i < len; i++) {
            authorityIds[i] = auths[i].authorityId;
            authorityNames[i] = auths[i].authorityName;
        }
    }

    function getCommitments(
        string calldata electionId,
        uint256 authorityId
    ) external view override returns (bytes[] memory) {
        uint idx = authorityIdToIndex[electionId][authorityId];
        return dkgCommitments[electionId][idx];
    }

    function getAuthorityActivity(
        string calldata electionId,
        uint256 authorityId
    )
        external
        view
        override
        returns (
            bytes memory publicKey,
            bool round1Done,
            bool round2Done,
            bool decryptionDone,
            bytes[] memory commitments
        )
    {
        uint idx = authorityIdToIndex[electionId][authorityId];
        Authority storage a = electionAuthorities[electionId][idx];

        return (
            a.publicKey,
            a.round1Done,
            a.round2Done,
            a.decryptionDone,
            dkgCommitments[electionId][idx]
        );
    }

    function getFinalResult(
        string calldata electionId
    )
        external
        view
        override
        returns (string[] memory candidates, uint256[] memory counts)
    {
        Election storage e = elections[electionId];
        uint len = e.candidateNames.length;

        candidates = new string[](len);
        counts = new uint256[](len);

        for (uint i = 0; i < len; i++) {
            candidates[i] = e.candidateNames[i];
            counts[i] = finalVoteCount[electionId][candidates[i]];
        }
    }

    function getEncryptedTally(
        string calldata electionId
    ) external view override returns (bytes[] memory) {
        return encryptedTallies[electionId];
    }
}