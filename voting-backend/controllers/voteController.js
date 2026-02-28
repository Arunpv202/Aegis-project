const db = require('../models');
const EncryptedVote = db.EncryptedVote;
const Election = db.Election;
const ElectionCrypto = db.ElectionCrypto;
const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');

exports.castVote = async (req, res) => {
    try {
        const { election_id } = req.params;
        const { proof, publicSignals, encryptedVote, nullifier } = req.body;

        // 1. Basic Validation
        console.log(`[Vote] Received vote request for election: ${election_id}`);
        // console.log("[Vote] Payload:", JSON.stringify(req.body, (key, value) => (key === 'proof' ? '...proof...' : value))); // Avoid big logs

        if (!election_id || !proof || !publicSignals || !encryptedVote || !nullifier) {
            console.error("[Vote] Missing required fields:", {
                hasElectionId: !!election_id,
                hasProof: !!proof,
                hasSignals: !!publicSignals,
                hasEncryptedVote: !!encryptedVote,
                hasNullifier: !!nullifier
            });
            return res.status(400).json({ success: false, message: "Missing required vote data" });
        }

        // 2. Check Election Status & Time
        const election = await Election.findByPk(election_id, {
            include: [{ model: ElectionCrypto }]
        });
        if (!election) {
            console.error(`[Vote] Election not found: ${election_id}`);
            return res.status(404).json({ success: false, message: "Election not found" });
        }
        console.log(`[Vote] Validated election existence: ${election.election_name}`);

        const blockchainService = require('../utils/blockchainService');
        const bcDetails = await blockchainService.getElectionDetails(election_id);

        if (!bcDetails || !bcDetails.initialized) {
            return res.status(404).json({ success: false, message: "Election not found on blockchain" });
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const startUnix = Number(bcDetails.startTime);
        const endUnix = Number(bcDetails.endTime);

        if (nowSec < startUnix) {
            return res.status(403).json({ success: false, message: "Election has not started yet." });
        }

        if (nowSec > endUnix) {
            console.warn(`[Vote] Attempt to vote after election ended. Now: ${new Date(nowSec * 1000)}, End: ${new Date(endUnix * 1000)}`);
            return res.status(403).json({ success: false, message: "Election has ended. Voting is closed." });
        }

        if (bcDetails.completed) {
            return res.status(403).json({ success: false, message: "Election voting is completed." });
        }

        // 3. Double Voting Check (Nullifier)
        console.log(`[Vote] Checking nullifier: ${nullifier}`);
        const existingVote = await EncryptedVote.findOne({
            where: {
                election_id,
                nullifier
            }
        });

        if (existingVote) {
            console.warn(`[Vote] Double voting attempt detected for nullifier: ${nullifier}`);
            return res.status(400).json({ success: false, message: "Double voting detected. Vote rejected." });
        }

        // 4. Verify ZK Proof
        // Load Verification Key
        // Assumption: verification_key.json is stored in backend/config/zk/verification_key.json
        const vKeyPath = path.join(__dirname, '..', 'config', 'zk', 'verification_key.json');

        console.log(`[Vote] Loading Verification Key from: ${vKeyPath}`);

        if (!fs.existsSync(vKeyPath)) {
            console.error("Verification key not found at:", vKeyPath);
            return res.status(500).json({ success: false, message: "Server configuration error: Verification key missing" });
        }

        const vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf8'));

        /* ------------------------------------------------------------------
         * SECURITY CHECK: VALIDATE PUBLIC SIGNALS
         * The ZK Proof proves: "I know a secret that produces these signals."
         * We must verify these signals match the REAL Election Data.
         * ------------------------------------------------------------------ */

        // Signal Order in vote.circom: [root, nullifier, electionId, C1..., C2...]
        const signalRoot = publicSignals[0];
        const signalNullifier = publicSignals[1];
        const signalElectionId = publicSignals[2];

        // 1. Verify Merkle Root matches Blockchain Root
        // DB might store "0x..." Hex, but we now pull RegistrationMerkleRoot from the smart contract
        const validRootSrc = bcDetails.registrationMerkleRoot || '0x';
        const dbRootBigInt = BigInt(validRootSrc);
        if (signalRoot !== dbRootBigInt.toString()) {
            console.error(`[Vote] SECURITY ALARM: Merkle Root Mismatch!`);
            console.error(`  Expected (Blockchain): ${dbRootBigInt.toString()}`);
            console.error(`  Received (Proof): ${signalRoot}`);
            return res.status(400).json({ success: false, message: "Invalid Merkle Root (Stale or Fake Tree)" });
        }

        // 2. Verify Nullifier matches Payload
        if (signalNullifier !== nullifier) {
            console.error(`[Vote] SECURITY ALARM: Nullifier Mismatch!`);
            console.error(`  Payload: ${nullifier}`);
            console.error(`  Proof:   ${signalNullifier}`);
            return res.status(400).json({ success: false, message: "Nullifier mismatch between payload and proof" });
        }

        // 3. Verify Election ID Binding
        // We must reconstruct the Election ID Hash using same logic as Frontend
        const { buildPoseidon } = require('circomlibjs');
        const SHA256 = require('crypto-js/sha256');
        const poseidon = await buildPoseidon();

        const hashHexString = SHA256(election_id).toString();
        const electionIdBigInt = BigInt("0x" + hashHexString) % poseidon.F.p;

        if (signalElectionId !== electionIdBigInt.toString()) {
            console.error(`[Vote] SECURITY ALARM: Election ID Mismatch!`);
            console.error(`  Expected (Hash): ${electionIdBigInt.toString()}`);
            console.error(`  Received (Proof): ${signalElectionId}`);
            return res.status(400).json({ success: false, message: "Proof is for a different election!" });
        }

        console.log("[Vote] Security Checks Passed: Root, Nullifier, and ElectionId match.");

        /* ------------------------------------------------------------------
         * ENCRYPTION VALIDITY CHECK (Chaum-Pedersen)
         * Ensure C1, C2 encrypts valid binary vote with Sum=1
         * ------------------------------------------------------------------ */
        const { validityProofs } = req.body;
        if (!validityProofs || !validityProofs.candidateProofs || !validityProofs.sumProof) {
            return res.status(400).json({ success: false, message: "Missing Encryption Validity Proofs" });
        }

        const zkUtils = require('../utils/zkProofs');
        const { ristretto255 } = require('@noble/curves/ed25519.js');
        const electionPK = bcDetails.electionPublicKey && bcDetails.electionPublicKey !== '0x'
            ? bcDetails.electionPublicKey
            : (election.ElectionCrypto ? election.ElectionCrypto.election_pk : null);

        if (!electionPK) {
            console.error(`[Vote] CRITICAL: Election Public Key not found for ${election_id}`);
            return res.status(500).json({ success: false, message: "Election Public Key configuration error" });
        }

        // 1. Verify Each Candidate (0 or 1)
        console.log("[Vote] Verifying Encryption Integrity...");

        let sumC1 = ristretto255.Point.ZERO;
        let sumC2 = ristretto255.Point.ZERO;

        for (let i = 0; i < encryptedVote.c1.length; i++) {
            const c1Hex = encryptedVote.c1[i];
            const c2Hex = encryptedVote.c2[i];
            const proof = validityProofs.candidateProofs[i];

            if (!zkUtils.verifyZeroOrOne(proof, electionPK, c1Hex, c2Hex)) {
                console.error(`[Vote] Encryption Validity Failed for Candidate ${i}`);
                return res.status(400).json({ success: false, message: `Invalid Encryption for Candidate ${i}` });
            }

            sumC1 = sumC1.add(ristretto255.Point.fromHex(c1Hex));
            sumC2 = sumC2.add(ristretto255.Point.fromHex(c2Hex));
        }

        // 2. Verify Sum (Sum = 1)
        if (!zkUtils.verifySumOfOne(validityProofs.sumProof, electionPK, sumC1.toHex(), sumC2.toHex())) {
            console.error("[Vote] Encryption Validity Failed for Vote Sum");
            return res.status(400).json({ success: false, message: "Invalid Vote Sum (Must be 1)" });
        }

        console.log("[Vote] Encryption Validity Verified (Chaum-Pedersen)");

        // Verify
        console.log("[Vote] Verifying ZK Proof...");
        // Log public signals for debugging mismatch
        console.log("[Vote] Public Signals (Received):", publicSignals);

        let verified = false;
        try {
            verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        } catch (vErr) {
            console.error("[Vote] Verification Process Check Failed:", vErr);
            return res.status(400).json({ success: false, message: "Proof verification execution failed" });
        }

        console.log(`[Vote] Proof Verification Result: ${verified}`);

        if (!verified) {
            console.warn(`[Vote] Invalid ZK Proof for election: ${election_id}`);
            return res.status(400).json({ success: false, message: "Invalid Zero-Knowledge Proof" });
        }

        // 5. Store Encrypted Vote
        // encryptedVote = { c1: [...], c2: [...] }
        await EncryptedVote.create({
            election_id,
            nullifier,
            c1: encryptedVote.c1, // stored as JSON array of strings
            c2: encryptedVote.c2
        });

        // 6. Submit to Blockchain
        const { ethers } = require('ethers');

        // Calculate a hash from c1 and c2 array elements
        const combinedString = encryptedVote.c1.join('') + encryptedVote.c2.join('');
        const encryptedVotehash = ethers.keccak256(ethers.toUtf8Bytes(combinedString));

        await blockchainService.submitVoteOnChain(election_id, nullifier, encryptedVotehash);

        console.log(`[Vote] Vote cast successfully for election: ${election_id}`);
        res.json({ success: true, message: "Vote cast successfully" });

    } catch (error) {
        console.error("Error casting vote:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
