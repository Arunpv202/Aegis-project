const db = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const blockchainService = require('../utils/blockchainService');
const ElectionCrypto = db.ElectionCrypto;
const Wallet = db.Wallet;
const EncryptedShare = db.EncryptedShare;

// Internal helper for Ristretto
async function getRistretto() {
    return import('@noble/curves/ed25519.js').then(m => m.ristretto255);
}

// Schnorr Verification Helper
// Schnorr Verification Helper
// Protocol: s * G = R + c * PK
// c = H(DomSep || R || PK || M)
// Schnorr Verification Helper
// Protocol: s * G = R + c * PK
// c = H(DomSep || R || PK || M)
async function verifySchnorr(pkHex, proof, electionId) {
    if (!proof || !proof.R || !proof.s) return false;
    const { R, s } = proof;
    const ristretto255 = await getRistretto();

    try {
        // Validate Hex Inputs
        if (!/^[0-9a-fA-F]{64}$/.test(pkHex) || !/^[0-9a-fA-F]{64}$/.test(R) || !/^[0-9a-fA-F]{64}$/.test(s)) {
            console.warn("Invalid Hex Format in ZKP");
            return false;
        }

        const R_point = ristretto255.Point.fromHex(R);
        const P_point = ristretto255.Point.fromHex(pkHex);

        // Domain Separated Challenge
        const hash = crypto.createHash('sha256');
        hash.update('Voting_Schnorr_Proof_v1'); // Domain Separation Tag
        hash.update(Buffer.from(R, 'hex'));
        hash.update(Buffer.from(pkHex, 'hex'));
        hash.update(Buffer.from(String(electionId)));

        const digest = hash.digest();

        // FIX: Hardcoded Group Order for Ristretto255 (same as Ed25519 scalar field)
        const L = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');

        const c_hex = digest.toString('hex');
        const c = BigInt('0x' + c_hex) % L;

        // Verify: s*G == R + c*PK
        const sG = ristretto255.Point.BASE.multiply(BigInt('0x' + s));
        const cP = P_point.multiply(c);
        const RHS = R_point.add(cP);

        const result = sG.equals(RHS);
        if (!result) {
            console.log("[ZKP Debug] Verification Failed:");
            console.log("  PK:", pkHex);
            console.log("  ElectionID:", electionId);
            console.log("  Computed Challenge (c):", c.toString(16));
            console.log("  LHS (s*G):", sG.toHex());
            console.log("  RHS (R+c*P):", RHS.toHex());
        }
        return result;

    } catch (e) {
        console.error("ZKP Verify Error:", e);
        return false;
    }
}



// Exported helper to trigger Round 1
// Supports dual signature: (election_id) OR (req, res)
exports.triggerRound1 = async (arg1, res) => {
    let election_id;
    let isHttp = false;
    let username = null;

    try {
        if (arg1 && arg1.body && arg1.body.election_id) {
            election_id = arg1.body.election_id;
            username = arg1.username; // From verifyToken middleware
            isHttp = true;
        } else if (typeof arg1 === 'string' || typeof arg1 === 'number') {
            election_id = arg1;
        } else {
            throw new Error('Invalid arguments to triggerRound1');
        }

        console.log(`[DKG] Triggering Round 1 for Election ${election_id}`);

        // [BLOCKCHAIN MIGRATION] Verify Creator and Start on Chain
        const electionDetails = await blockchainService.getElectionDetails(election_id);
        if (!electionDetails) {
            if (isHttp && res) return res.status(404).json({ message: 'Election not found on blockchain' });
            throw new Error('Election not found on blockchain');
        }

        if (isHttp && username) {
            // Verify Creator
            if (electionDetails.creatorName !== username) {
                console.warn(`[DKG] Unauthorized Round 1 Trigger: ${username} is not creator of ${election_id}`);
                return res.status(403).json({ message: 'Unauthorized: Only election creator can start Round 1' });
            }
        }

        await blockchainService.startRound1OnChain(election_id);

        /* [DATABASE DEPRECATION]
        const now = new Date();
        const threeMinutes = 3 * 60 * 1000;
        const endTime = new Date(now.getTime() + threeMinutes);

        const [crypto, created] = await ElectionCrypto.upsert({
            election_id,
            status: 'round1',
            round1_start_time: now,
            round1_end_time: endTime
        });
        console.log(`[DKG] Round 1 started. Ends at ${endTime.toISOString()}`);
        */

        if (isHttp && res) {
            res.json({ message: 'Round 1 Triggered successfully on Blockchain' });
        }

    } catch (error) {
        console.error(`[DKG] Error triggering Round 1 for ${election_id}:`, error);
        if (isHttp && res) {
            res.status(500).json({ message: error.message });
        }
    }
};

exports.getDkgStatus = async (req, res) => {
    try {
        const { election_id } = req.params;

        // Fetch from Blockchain
        const electionDetails = await blockchainService.getElectionDetails(election_id);

        if (!electionDetails || !electionDetails.initialized) {
            return res.status(404).json({ message: 'Election not found on blockchain' });
        }

        // Only return polynomial_degree as requested
        // Fix: Convert BigInt to string to avoid JSON serialization error
        // Determine Election Status from Blockchain Flags
        let status = 'setup';
        if (electionDetails.completed) status = 'completed';
        else if (electionDetails.round2Active) status = 'round2';
        else if (electionDetails.round1Active) status = 'round1';
        else if (electionDetails.setupDone) status = 'setup_completed'; // Ready for Round 1, but not started
        else if (electionDetails.initialized) status = 'created';

        // Check if all authorities have completed Round 2
        const authorities = await blockchainService.getAuthoritiesWithConfig(election_id);
        const allRound2Done = authorities && authorities.length > 0 && authorities.every(a => a.round2Done);

        res.json({
            status: status,
            polynomial_degree: electionDetails.degree.toString(),
            allRound2Done: allRound2Done
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.triggerRound2 = async (req, res) => {
    try {
        const { election_id } = req.body;
        const username = req.username; // From verifyToken

        // [BLOCKCHAIN MIGRATION] Verify Creator and Start on Chain
        const electionDetails = await blockchainService.getElectionDetails(election_id);
        if (!electionDetails) {
            return res.status(404).json({ message: 'Election not found on blockchain' });
        }

        // Verify Creator
        if (electionDetails.creatorName !== username) {
            console.warn(`[DKG] Unauthorized Round 2 Trigger: ${username} is not creator of ${election_id}`);
            return res.status(403).json({ message: 'Unauthorized: Only election creator can start Round 2' });
        }

        await blockchainService.startRound2OnChain(election_id);

        /* [DATABASE DEPRECATION]
        const crypto = await ElectionCrypto.findByPk(election_id);
        if (!crypto) return res.status(404).json({ message: 'Election not found' });

        crypto.status = 'round2';
        // crypto.round1_end_time = new Date(); // Update timestamps if tracking
        await crypto.save();
        */

        res.json({ message: 'Round 2 manually triggered on Blockchain' });
    } catch (error) {
        console.error(`[DKG] Error triggering Round 2 for ${req.body.election_id}:`, error);
        res.status(500).json({ message: error.message });
    }
};

exports.submitPublicKey = async (req, res) => {
    try {
        const { election_id, pk, proof } = req.body;
        const username = req.username; // Trusted from Token

        console.log(`[DKG DEBUG] submitPublicKey - Start processing for User: ${username}, Election: ${election_id}`);

        // 1. Basic Validation
        if (!election_id || !username || !pk || !proof) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        if (!/^[0-9a-fA-F]{64}$/.test(pk)) {
            return res.status(400).json({ message: 'Invalid Public Key Format' });
        }

        // 2. Check that Round 1 is active on chain
        const electionDetails = await blockchainService.getElectionDetails(election_id);
        if (!electionDetails) {
            return res.status(404).json({ message: 'Election not found on blockchain' });
        }
        if (!electionDetails.round1Active) {
            return res.status(400).json({ message: 'Round 1 has not started yet. Please wait for the admin to start Round 1.' });
        }

        // 3. Resolve Authority on Chain
        const onChainAuths = await blockchainService.getAuthorities(election_id);
        if (!onChainAuths) return res.status(404).json({ message: 'Election authorities not found on chain' });

        const myAuth = onChainAuths.find(a => a.authorityName === username);
        if (!myAuth) {
            return res.status(403).json({ message: 'You are not a registered authority for this election.' });
        }

        const authorityId = myAuth.authorityId;
        const existingPk = myAuth.publicKey; // likely '0x...' or '0x' if empty

        // 3. Prevent Duplicate Submission
        if (existingPk && existingPk !== '0x') {
            // Ethers returns hex strings. Compare.
            // valid pk is 32 bytes (64 chars) + '0x' = 66 chars
            const submittedPkHex = pk.startsWith('0x') ? pk : '0x' + pk;

            if (existingPk.toLowerCase() === submittedPkHex.toLowerCase()) {
                return res.json({ message: 'Public Key already submitted', authority_id: authorityId.toString() });
            } else {
                return res.status(409).json({ message: 'A different Public Key is already registered for this authority on chain.' });
            }
        }

        /* [DATABASE DEPRECATION] 
        // Logic removed: ElectionCrypto check, Wallet lookup, Wallet update
        */

        // 4. Check PK uniqueness — reject if another authority already uses this PK
        const submittedPkNormalized = ('0x' + pk.replace(/^0x/, '')).toLowerCase();
        const pkConflict = onChainAuths.find(a => {
            // Skip self
            if (a.authorityName === username) return false;
            const theirPk = a.publicKey;
            // Skip empty / unset PKs ("0x" or falsy)
            if (!theirPk || theirPk === '0x') return false;
            return theirPk.toLowerCase() === submittedPkNormalized;
        });
        if (pkConflict) {
            console.warn(`[DKG] PK collision: ${username} tried to submit a PK already owned by ${pkConflict.authorityName} in election ${election_id}`);
            return res.status(409).json({
                message: `Public key is already registered by another authority (${pkConflict.authorityName}). Each authority must use a unique key.`
            });
        }

        // 5. Verify ZKP
        const isValid = await verifySchnorr(pk, proof, election_id);
        if (!isValid) {
            console.warn(`[DKG] Invalid ZKP for ${username} in election ${election_id}`);
            return res.status(400).json({ message: 'Zero-Knowledge Proof Verification Failed.' });
        }

        // 5. Submit to Blockchain
        // [UPDATE] We only store the hash of the proof on-chain now.
        // proof is {R, s}, both 32-byte hex strings.
        const proofPayload = proof.R + proof.s;
        const proofHash = '0x' + crypto.createHash('sha256').update(Buffer.from(proofPayload, 'hex')).digest('hex');

        await blockchainService.submitRound1OnChain(
            election_id,
            authorityId,
            pk.startsWith('0x') ? pk : '0x' + pk, // Ensure hex prefix for bytes
            proofHash // Send hash as 'bytes'
        );

        console.log(`[DKG] PK Submitted to Blockchain for AuthID ${authorityId}`);

        res.json({
            message: 'Public key verified and submitted successfully to Blockchain',
            authority_id: authorityId.toString()
        });

    } catch (error) {
        console.error(error);
        if (error.message && error.message.includes("Round1 already done")) {
            return res.status(409).json({ message: 'Round 1 already submitted (Contract Revert).' });
        }
        if (!res.headersSent) res.status(500).json({ message: error.message });
    }
};

exports.submitRound2 = async (req, res) => {
    try {
        const { election_id, commitments, shares } = req.body;
        const username = req.username; // Trusted from Token

        // 1. Validate Inputs
        if (!commitments || !Array.isArray(commitments) || commitments.length === 0) {
            return res.status(400).json({ message: 'Invalid commitments. Must be a non-empty array of hex strings.' });
        }

        // 2. Resolve Authority on Chain
        const onChainAuths = await blockchainService.getAuthorities(election_id);
        if (!onChainAuths) return res.status(404).json({ message: 'Election authorities not found on chain' });

        const myAuth = onChainAuths.find(a => a.authorityName === username);
        if (!myAuth) {
            return res.status(403).json({ message: 'You are not a registered authority for this election.' });
        }

        // Check if Round 2 is already complete for this authority
        if (myAuth.round2Done) {
            return res.status(409).json({ message: 'Round 2 already submitted.' });
        }

        const fromAuthorityId = myAuth.authorityId;

        // 3. Submit Commitments to BLOCKCHAIN
        // Ensure 0x prefix for Ethers.js
        const sanitizedCommitments = commitments.map(c => c.startsWith('0x') ? c : '0x' + c);

        await blockchainService.submitDKGRound2({
            electionId: election_id,
            fromAuthorityId: fromAuthorityId,
            commitments: sanitizedCommitments
        });

        // 4. Store Encrypted Shares in DATABASE (as requested)
        if (shares && Array.isArray(shares) && shares.length > 0) {
            const shareRecords = shares.map(s => ({
                election_id,
                from_authority_id: fromAuthorityId,
                to_authority_id: s.to_authority_id,
                encrypted_share: s.encrypted_share
            }));

            await EncryptedShare.bulkCreate(shareRecords);
            console.log(`[DKG] Stored ${shareRecords.length} encrypted shares in DB for opponents.`);
        }

        res.json({ message: 'Round 2 submission accepted (Commitments on Chain, Shares in DB).' });

    } catch (error) {
        console.error(`[DKG] Error submitRound2:`, error);
        if (error.message && error.message.includes("Round2 already done")) {
            return res.status(409).json({ message: 'Round 2 already submitted.' });
        }
        res.status(500).json({ message: error.message });
    }
};

exports.getShares = async (req, res) => {
    try {
        const { election_id, authority_id } = req.params;

        // 1. Fetch encrypted shares from DB
        const shares = await EncryptedShare.findAll({
            where: {
                election_id,
                to_authority_id: authority_id
            }
        });

        // 2. Fetch sender details (commitments/PKs) from BLOCKCHAIN
        // We need the commitments to verify the shares on client side.
        const onChainAuths = await blockchainService.getAuthoritiesWithConfig(election_id);

        // 3. Enrich shares with sender info
        const enrichedShares = shares.map(share => {
            // Find the sender in the on-chain list
            // Note: onChainAuths should have authorityId as BigInt or Number.
            // EncryptedShare.from_authority_id is likely Number or String.
            const sender = onChainAuths ? onChainAuths.find(a => String(a.authorityId) === String(share.from_authority_id)) : null;

            return {
                ...share.toJSON(), // Ensure we have a plain object
                sender_commitment: sender ? sender.commitment : null,
                sender_pk: sender ? sender.publicKey : null
            };
        });

        console.log(`[DKG] Returning ${enrichedShares.length} opponent shares for Authority ${authority_id}`);
        res.json({ shares: enrichedShares });
    } catch (error) {
        console.error("Error in getShares:", error);
        res.status(500).json({ message: error.message });
    }
}


exports.getAuthorities = async (req, res) => {
    try {
        const { election_id } = req.params;

        // [BLOCKCHAIN MIGRATION]
        const onChainAuths = await blockchainService.getAuthoritiesWithConfig(election_id);
        const electionDetails = await blockchainService.getElectionDetails(election_id);
        const creatorName = electionDetails ? electionDetails.creatorName : null;

        // console.log(`[DKG DEBUG] Election: ${election_id}, Creator: '${creatorName}'`);

        /* [DATABASE DEPRECATION]
        const authorities = await Wallet.findAll({ ... });
        */

        const authorities = onChainAuths ? onChainAuths.map(auth => ({
            authority_id: auth.authorityId.toString(),
            pk: auth.publicKey,
            username: auth.authorityName,
            commitment: auth.commitment, // Using enriched commitment string
            role: 'authority', // Default for now
            // [UPDATE] Include status flags from blockchain
            round1Done: auth.round1Done,
            round2Done: auth.round2Done,
        })) : [];

        // Resolve "My Authority ID" if user is trusted (from token)
        let my_authority_id = null;
        if (req.username) {
            // console.log(`[DKG DEBUG] getAuthorities - Request from User: ${req.username}`);
            const self = authorities.find(a => a.username === req.username);
            if (self) {
                my_authority_id = self.authority_id; // Already a string from above map
                // console.log(`[DKG DEBUG] getAuthorities - Resolved Self to Authority ID: ${my_authority_id}`);
            }
        }

        // console.log(`[DKG DEBUG] getAuthorities - Returning ${authorities.length} authorities. MyAuthID: ${my_authority_id}`);
        res.json({ authorities, my_authority_id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

exports.initRound2 = async (req, res) => {
    try {
        const { election_id } = req.body;
        const username = req.username; // Trusted from Token

        // 1. Check Election Status (BLOCKCHAIN ONLY)
        const details = await blockchainService.getElectionDetails(election_id);
        if (!details) {
            return res.status(404).json({ message: 'Election not found on chain' });
        }

        let status = 'setup';
        if (details.completed) status = 'completed';
        else if (details.round2Active) status = 'round2';
        else if (details.round1Active) status = 'round1';
        else if (details.setupDone) status = 'round1'; // Implicit

        // Temporarily allow if completed too
        if (status !== 'round2' && status !== 'completed') {
            return res.status(400).json({ message: `Round 2 is not active. Current status: ${status}` });
        }

        // 2. Find My Authority ID & Peers (BLOCKCHAIN ONLY)
        const onChainAuths = await blockchainService.getAuthorities(election_id);
        if (!onChainAuths) return res.status(404).json({ message: 'Authorities not found on chain' });

        // Resolve "Me"
        const myAuthOnChain = onChainAuths.find(a => a.authorityName === username.trim());
        if (!myAuthOnChain) {
            return res.status(403).json({ message: 'You are not an authority in this election.' });
        }

        // Resolve Peers (Everyone else)
        // Ensure to stringify BigInts
        const peers = onChainAuths
            .filter(a => a.authorityName !== username.trim())
            .map(a => ({
                authority_id: a.authorityId.toString(),
                pk: a.publicKey,
                commitment: a.commitment // might be undefined/null if not yet set in Round 1
            }));

        res.json({
            authority_id: myAuthOnChain.authorityId.toString(),
            peers
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
}

exports.getAdminStatus = async (req, res) => {
    try {
        const { election_id } = req.params;

        // [BLOCKCHAIN MIGRATION] Fetch status from chain
        const electionDetails = await blockchainService.getElectionDetails(election_id);
        const onChainAuthorities = await blockchainService.getAuthorities(election_id);

        if (!electionDetails) {
            return res.status(404).json({ message: 'Election not found on blockchain' });
        }

        /* [DATABASE DEPRECATION] 
        // Fetch Election Crypto Status
        const crypto = await ElectionCrypto.findByPk(election_id);
        // Fetch all potential authorities
        const authorities = await Wallet.findAll({ ... });
        */

        // Determine Election Status from Blockchain Flags
        let status = 'setup';
        if (electionDetails.completed) status = 'completed';
        else if (electionDetails.round2Active) status = 'round2';
        else if (electionDetails.round1Active) status = 'round1';
        else if (electionDetails.setupDone) status = 'setup_completed'; // Ready for Round 1
        else if (electionDetails.initialized) status = 'created';

        // Map Blockchain Authorities to Frontend Format
        const detailed = onChainAuthorities.map(a => {
            // Struct: { authorityId, authorityName, publicKey, round1Done, round2Done ... }
            const hasRound1 = a.round1Done;
            const hasRound2 = a.round2Done;

            let authStatus = 'Pending Round 1';
            if (hasRound1) authStatus = 'Pending Round 2';
            if (hasRound2) authStatus = 'Completed';

            return {
                authority_id: a.authorityId.toString(), // Fix: BigInt to String
                username: a.authorityName, // on-chain name
                // role: 'authority', // inferred
                has_round1: hasRound1,
                has_round2: hasRound2,
                status: authStatus,
                pk: a.publicKey // raw bytes or hex depending on contract return
            };
        });

        // console.log(`[DKG DEBUG] AdminStatus (Blockchain) for ${election_id}: Found ${detailed.length} authorities`);

        res.json({
            authorities: detailed,
            election_status: status,
            election_pk: electionDetails.electionPublicKey
        });

    } catch (error) {
        console.error("Error in getAdminStatus:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.computeElectionKeys = async (req, res) => {
    try {
        const { election_id } = req.body;
        const username = req.username; // From verifyToken

        // [BLOCKCHAIN MIGRATION] Check status on chain
        const electionDetails = await blockchainService.getElectionDetails(election_id);
        if (!electionDetails) return res.status(404).json({ message: 'Election not found on blockchain' });

        // Verify Creator
        if (electionDetails.creatorName !== username) {
            return res.status(403).json({ message: 'Unauthorized: Only election creator can finalize DKG' });
        }

        // Guard: If election PK is already set on-chain, don't recompute
        const existingPK = electionDetails.electionPublicKey;
        if (existingPK && existingPK !== '0x' && existingPK.length > 2) {
            console.log(`[DKG] Election PK already exists on chain. Skipping recomputation.`);
            return res.json({ message: 'DKG Already Finalized.', election_pk: existingPK });
        }

        /* [DATABASE DEPRECATION]
        // DB check removed
        */

        // Fetch all authorities from Blockchain
        const authorities = await blockchainService.getAuthoritiesWithConfig(election_id);


        if (!authorities || authorities.length === 0) {
            return res.status(400).json({ message: 'No authorities found on chain.' });
        }

        const ristretto255 = await getRistretto();
        let sumPoint = ristretto255.Point.ZERO;
        let success = true;

        for (const auth of authorities) {
            if (!auth.round2Done) {
                return res.status(400).json({
                    message: `Cannot finalize: Authority ${auth.authorityName} has not completed Round 2.`
                });
            }


            try {
                const commitmentParts = await blockchainService.getCommitments(election_id, auth.authorityId);
                // Expecting array of bytes (hex strings)

                if (!commitmentParts || commitmentParts.length === 0) {
                    throw new Error("Empty commitment on chain");
                }

                // C0 is the first coefficient (constant term)
                const C0_Hex = commitmentParts[0]; // e.g. "0x..."

                // Clean 0x
                const hexClean = C0_Hex.startsWith('0x') ? C0_Hex.slice(2) : C0_Hex;

                const point = ristretto255.Point.fromHex(hexClean);
                sumPoint = sumPoint.add(point);

            } catch (e) {
                console.error(`[DKG] Failed to aggregate from AuthID ${auth.authorityId}:`, e);
                success = false;
                break;
            }
        }

        if (success) {
            const electionPK = '0x' + sumPoint.toHex(); // Ensure 0x for consistency

            // Submit to Blockchain
            await blockchainService.setElectionPublicKeyOnChain(election_id, electionPK);

            console.log(`[DKG] Election PK Computed and Sent to Chain: ${electionPK}`);
            res.json({ message: 'DKG Finalized. Election Public Key Computed and Sent to Blockchain.', election_pk: electionPK });
        } else {
            return res.status(500).json({ message: 'Aggregation failed due to missing or corrupted commitment data on chain.' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

exports.verifyAuthority = async (req, res) => {
    try {
        const { election_id } = req.body;
        const username = req.username; // From verifyToken

        if (!election_id) {
            return res.status(400).json({ message: "Election ID is required" });
        }

        // 1. Fetch Authorities from Blockchain
        const onChainAuths = await blockchainService.getAuthorities(election_id);

        if (!onChainAuths) {
            return res.status(404).json({ message: "Election authorities not found on chain" });
        }

        // 2. Check if User is an Authority
        const isAuthority = onChainAuths.some(a => a.authorityName === username);

        if (isAuthority) {
            // Check if also Creator
            const electionDetails = await blockchainService.getElectionDetails(election_id);
            const isCreator = electionDetails && electionDetails.creatorName === username;

            return res.status(200).json({
                message: "Authorized",
                authorized: true,
                isCreator: isCreator
            });
        } else {
            return res.status(403).json({ message: "Unauthorized: You are not an authority for this election.", authorized: false });
        }

    } catch (error) {
        console.error("Error in verifyAuthority:", error);
        res.status(500).json({ message: error.message });
    }
};
