const { Election, ElectionCrypto, DecryptionShare, Candidate } = require('../models');
const { verifyDecryptionShare } = require('../utils/zkProofs');
const dlpSolver = require('../utils/dlp');
const { ristretto255 } = require('@noble/curves/ed25519.js');

exports.getDecryptionStatus = async (req, res) => {
    try {
        const { election_id, authority_id } = req.params;
        const share = await DecryptionShare.findOne({ where: { election_id, authority_id } });
        res.json({ hasSubmitted: !!share });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper to reconstruct Public Key of Authority `i` using Lagrange Interpolation on Commitments
// Y_i = sum( C_k * i^k )
function deriveAuthorityPublicKey(authorityId, commitments) {
    // commitments is Array of Hex Strings [C_0, C_1, ...]
    if (!commitments || commitments.length === 0) return null;

    const i = BigInt(authorityId);
    let Y_i = ristretto255.Point.ZERO;

    for (let k = 0; k < commitments.length; k++) {
        const C_k = ristretto255.Point.fromHex(commitments[k]);
        let i_k = BigInt(1);
        if (k > 0) i_k = i ** BigInt(k); // i^k

        const term = C_k.multiply(i_k);
        Y_i = Y_i.add(term);
    }
    return Y_i.toHex();
}

exports.submitDecryptionShare = async (req, res) => {
    try {
        const { election_id, authority_id, share_data, proof } = req.body;

        const election = await Election.findByPk(election_id, {
            include: [{ model: ElectionCrypto }]
        });

        const blockchainService = require('../utils/blockchainService');
        const bcTally = await blockchainService.getEncryptedTally(election_id);

        if (!bcTally || !bcTally.c1 || bcTally.c1.length === 0) {
            return res.status(400).json({ success: false, message: "Election tally not found on blockchain (not ready for decryption)" });
        }

        // 0. Check Duplicate Submission
        const existingShare = await DecryptionShare.findOne({
            where: { election_id, authority_id }
        });

        if (existingShare) {
            return res.status(409).json({ success: false, message: "You have already submitted your decryption share." });
        }

        // 1. Verify ZK Proof for EACH component
        const c1_strings = bcTally.c1;

        console.log(`[Result Debug] Decrypting Election ${election_id}`);
        console.log(`[Result Debug] Tally Components: ${c1_strings.length}`);
        console.log(`[Result Debug] Submitted Shares: ${share_data.c1_components.length}`);

        if (share_data.c1_components.length !== c1_strings.length) {
            console.error(`[Result Error] Share dimension mismatch.`);
            return res.status(400).json({ success: false, message: "Invalid share dimension" });
        }

        // ... (Public Key derivation code) ...



        // We need Authority's Public Key to verification.
        // It helps validation. But "Authority Public Key" is not stored directly?
        // Wait, DKG "Peer" data has PKs. But we don't store them in DB easily accessibly.
        // We DO store `commitment` in Wallet for that election/authority?
        // Let's check Wallet table.
        // We need the ACTUAL Public Key Share corresponding to the Private Key Share (x_i).
        // x_i = Sum( shares derived from ALL authorities' polynomials evaluated at i )
        // share from auth j to i: s_{j->i} = P_j(i)
        // x_i = Sum_j ( P_j(i) )
        // Y_i = x_i * G = Sum_j ( P_j(i) * G )
        // P_j(i) * G = (Sum_k c_jk * i^k) * G = Sum_k (c_jk * G) * i^k = Sum_k C_jk * i^k
        // So Y_i = Sum_j [ Sum_k C_jk * i^k ]

        // 1. Fetch ALL authorities securely from the blockchain
        const authorities = await blockchainService.getAuthorities(election_id);

        if (!authorities || authorities.length === 0) {
            return res.status(500).json({ success: false, message: "No authorities found on blockchain." });
        }

        // 2. Sum up evaluations
        let Y_i_Total = ristretto255.Point.ZERO;
        const i_val = BigInt(authority_id);
        let foundCommitments = false;

        for (const auth of authorities) {
            try {
                // Retrieve commitments directly from blockchain storage
                const commsArray = await blockchainService.getCommitments(election_id, auth.authorityId);
                if (!commsArray || commsArray.length === 0) continue;

                foundCommitments = true;

                // Evaluate P_j(i) * G using commitments
                let Y_j_at_i = ristretto255.Point.ZERO;

                for (let k = 0; k < commsArray.length; k++) {
                    let cleanHex = commsArray[k];
                    if (cleanHex.startsWith('0x')) cleanHex = cleanHex.slice(2);

                    const C_jk = ristretto255.Point.fromHex(cleanHex);
                    let i_k = BigInt(1);
                    if (k > 0) i_k = i_val ** BigInt(k);

                    const term = C_jk.multiply(i_k);
                    Y_j_at_i = Y_j_at_i.add(term);
                }

                // Add to Total
                Y_i_Total = Y_i_Total.add(Y_j_at_i);

            } catch (err) {
                console.error(`Error processing commitment for auth ${auth.authorityId}`, err);
                // Strict: skip or fail. We'll skip and see.
            }
        }

        if (!foundCommitments) {
            return res.status(500).json({ success: false, message: "No DKG commitments found on server." });
        }

        const Y_i = Y_i_Total.toHex();
        console.log(`[ZK Verify] Derived Public Key for Auth ${authority_id}: ${Y_i}`);

        // Verify Loop
        for (let i = 0; i < c1_strings.length; i++) {
            const isValid = verifyDecryptionShare(
                proof[i],
                Y_i,
                c1_strings[i],
                share_data.c1_components[i]
            );

            if (!isValid) {
                console.error(`[Result Error] ZK Proof Failed at index ${i}`);
                console.error(`Y_i: ${Y_i}`);
                console.error(`C1: ${c1_strings[i]}`);
                console.error(`D: ${share_data.c1_components[i]}`);
                return res.status(400).json({ success: false, message: `ZK Proof Verification Failed for component ${i}` });
            }
        }

        // [BLOCKCHAIN MIGRATION] Lock the hash of the share into the smart contract
        const { ethers } = require('ethers');

        // Create a definitive hash out of the array of strings
        // Stringify ensures deterministic ordering of the JS array
        const shareString = JSON.stringify(share_data.c1_components);
        const partialDecryptionHash = ethers.keccak256(ethers.toUtf8Bytes(shareString));

        console.log(`[Blockchain] Locking Partial Decryption Hash onto Contract: ${partialDecryptionHash}`);

        await blockchainService.submitPartialDecryption(
            election_id,
            authority_id,
            partialDecryptionHash
        );

        // 2. Store full array in DB
        await DecryptionShare.upsert({
            election_id,
            authority_id,
            share_data,
            proof
        });

        // 3. Check Threshold & Reconstruct if ready
        await checkAndReconstruct(election_id);

        res.json({ success: true, message: "Share verified, hashed on-chain, and accepted locally." });

    } catch (error) {
        console.error("Submit Share Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

async function checkAndReconstruct(electionId) {


    // [BLOCKCHAIN MIGRATION] Fetch setup details from blockchain directly
    const blockchainService = require('../utils/blockchainService');
    const bcDetails = await blockchainService.getElectionDetails(electionId);

    if (!bcDetails || bcDetails.threshold === undefined) {
        console.error(`[Result] Election ${electionId} details missing from blockchain.`);
        return;
    }

    // Guard: If results are already published on-chain, skip reconstruction
    if (bcDetails.completed) {
        console.log(`[Result] Election ${electionId} already finalized on blockchain. Skipping reconstruction.`);
        return;
    }

    const shares = await DecryptionShare.findAll({ where: { election_id: electionId } });

    // The blockchain natively stores the mathematically required threshold at bcDetails.threshold.
    const threshold = Number(bcDetails.threshold);

    if (shares.length < threshold) {
        console.log(`[Result] ${shares.length}/${threshold} shares received. Waiting for more authorities...`);
        return;
    }

    console.log(`[Result] Threshold reached! Reconstructing...`);

    // Issue 3 Fix: Use exactly `threshold` shares for Lagrange interpolation.
    // Using more shares than the polynomial degree allows produces an incorrect result.
    const eligibleShares = shares.slice(0, threshold);
    console.log(`[Result] Using ${eligibleShares.length} of ${shares.length} available shares (threshold=${threshold}).`);

    // Reconstruct S (Noise Vector)
    // S = sum( D_i * lambda_i )

    // Calculate Lagranges
    const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
    const authorityIds = eligibleShares.map(s => BigInt(s.authority_id));

    // Issue 2 Fix: Safe access to share_data.c1_components (DataTypes.JSON auto-parsed by Sequelize).
    const firstShareData = eligibleShares[0].share_data;
    if (!firstShareData || !firstShareData.c1_components || !Array.isArray(firstShareData.c1_components)) {
        console.error(`[Result] share_data.c1_components missing or invalid in first share for ${electionId}. Aborting.`);
        return;
    }
    const numCandidates = firstShareData.c1_components.length;
    let S_vector = new Array(numCandidates).fill(ristretto255.Point.ZERO);

    for (const share of eligibleShares) {
        const i = BigInt(share.authority_id);

        // Lambda_i = prod( -j / (i-j) ) for j != i
        let num = 1n;
        let den = 1n;

        for (const j of authorityIds) {
            if (i === j) continue;
            // num *= (0 - j) => -j
            let n_j = (0n - j) % CURVE_ORDER;
            if (n_j < 0n) n_j += CURVE_ORDER;
            num = (num * n_j) % CURVE_ORDER;

            // den *= (i - j)
            let d_j = (i - j) % CURVE_ORDER;
            if (d_j < 0n) d_j += CURVE_ORDER;
            den = (den * d_j) % CURVE_ORDER;
        }

        // Modular Inverse of den
        // Since order is prime, inv(d) = d^(p-2)
        const denInv = invert(den, CURVE_ORDER);
        const lambda = (num * denInv) % CURVE_ORDER;

        // Add D_i * lambda to sum
        // share_data is DataTypes.JSON — already a JS object from Sequelize, no JSON.parse needed.
        const D_components = share.share_data.c1_components.map(h => ristretto255.Point.fromHex(h));

        S_vector = S_vector.map((P, idx) => {
            const term = D_components[idx].multiply(lambda);
            return P.add(term);
        });
    }

    // Decrypt M = C2 - S
    const bcTally = await blockchainService.getEncryptedTally(electionId);

    if (!bcTally || !bcTally.c2 || bcTally.c2.length === 0) {
        console.error("Tally missing during reconstruction.");
        return;
    }

    const C2_vector = bcTally.c2.map(h => ristretto255.Point.fromHex(h));

    const results = [];

    for (let idx = 0; idx < numCandidates; idx++) {
        const M = C2_vector[idx].subtract(S_vector[idx]);

        // Solve DLP
        const voteCount = dlpSolver.solve(M.toHex());
        results.push(voteCount);
    }

    console.log(`[Result] Decrypted Votes:`, results);

    // Update DB
    const candidates = await Candidate.findAll({
        where: { election_id: electionId },
        order: [['id', 'ASC']]
    });

    // Sort or Map? Results are indexed 0..N.
    // We assume candidate fetching follows same order usually ID sorted?
    // Better relies on specific ID but our crypto vector is index based.
    // Assuming DB Candidates are same order used during Voting (VotePage.jsx uses candidate List).
    // VotePage candidates are sorted by? 'id' usually standard.
    // If backend ensures order, we apply order.

    // Verify candidate count matches
    // Candidates might have "dummy" ones padded to 10?
    // Our vector is 10. Candidates might be 3.
    // Map first N results to candidates.

    const finalCounts = [];
    for (let i = 0; i < candidates.length; i++) {
        if (i < results.length) {
            candidates[i].vote_count = results[i];
            await candidates[i].save();
            finalCounts.push(results[i]); // Keep track for Blockchain
        } else {
            finalCounts.push(0); // Saftey fallback
        }
    }

    // [BLOCKCHAIN MIGRATION] Publish final counts to Smart Contract
    try {
        await blockchainService.publishFinalResult(electionId, finalCounts);
        console.log(`[Result] Blockchain tally published successfully for ${electionId}.`);
    } catch (bcErr) {
        console.error(`[Result] Failed to publish tally to blockchain for ${electionId}:`, bcErr);
        // We might want to throw or just log. Since DB is updating, we log for now.
    }
    console.log(`[Result] Election ${electionId} Finalized.`);
}

// Modular Inverse
function invert(number, modulo) {
    if (number === 0n || modulo <= 0n) {
        throw new Error('invert: invalid arguments');
    }
    let a = number, b = modulo;
    let x = 0n, y = 1n, u = 1n, v = 0n;
    while (a !== 0n) {
        const q = b / a;
        const r = b % a;
        const m = x - u * q;
        const n = y - v * q;
        b = a; a = r; x = u; y = v; u = m; v = n;
    }
    const res = x % modulo;
    return res < 0n ? res + modulo : res;
}

exports.checkAndReconstruct = checkAndReconstruct;
