const db = require('../models');
const Election = db.Election;
const RegistrationToken = db.RegistrationToken;
const Candidate = db.Candidate;
const Wallet = db.Wallet;
const ElectionVoter = db.ElectionVoter;
const ElectionCrypto = db.ElectionCrypto;
const MerkleTreeService = require('../utils/merkleTree');
const dkgController = require('./dkgController');
const blockchainService = require('../utils/blockchainService');
const { ethers } = require('ethers');

// Helper for Auto Merkle Root Generation
const generateMerkleRoot = async (election_id) => {
    console.log(`Starting Merkle Root generation for ${election_id}`);
    try {
        // 1. Check Blockchain Status
        const onChainElection = await blockchainService.getElectionDetails(election_id);
        if (!onChainElection || !onChainElection.initialized) {
            console.error(`Election ${election_id} not found on blockchain during Merkle Root generation.`);
            return;
        }

        // 2. Fetch used tokens with commitments
        const tokens = await RegistrationToken.findAll({
            where: {
                election_id,
                status: 'used'
            }
        });

        const commitments = tokens.map(t => t.commitment).filter(c => c).sort();
        console.log(`Debug: Commitments used for Merkle Root:`, commitments);
        let root = null;

        if (commitments.length > 0) {
            const merkleService = new MerkleTreeService(commitments);
            await merkleService.build();
            root = merkleService.getRoot();
        } else {
            root = '0x0000000000000000000000000000000000000000000000000000000000000000';
        }

        // ===== FACE DATA MERKLE ROOT =====
        // Hash each encrypted face descriptor, then build a Merkle root
        const faceDescriptors = tokens
            .map(t => t.face_descriptor)
            .filter(f => f)
            .sort();

        let faceDatabaseHash = ethers.ZeroHash; // default if no face data

        if (faceDescriptors.length > 0) {
            // Hash each encrypted descriptor
            const faceLeaves = faceDescriptors.map(encDesc =>
                ethers.keccak256(ethers.toUtf8Bytes(encDesc))
            );
            console.log(`Debug: ${faceLeaves.length} face descriptor hashes for Merkle Root`);

            // Build Merkle tree from the hashed leaves
            const faceMerkleService = new MerkleTreeService(faceLeaves);
            await faceMerkleService.build();
            const faceRoot = faceMerkleService.getRoot();

            // Convert to bytes32 for the smart contract
            faceDatabaseHash = ethers.keccak256(ethers.toUtf8Bytes(faceRoot));
            console.log(`Face Database Hash (bytes32): ${faceDatabaseHash}`);
        } else {
            console.log('No face descriptors found, using ZeroHash for faceDatabaseHash.');
        }

        // Fetch Authorities count to dynamically calculate polynomial degree
        const authorities = await blockchainService.getAuthorities(election_id);
        const numAuthorities = authorities ? authorities.length : 1;

        // degree = numAuthorities - 2 (e.g. 4 authorities -> degree 2)
        // The blockchain automatically sets threshold = degree + 1 inside finalizeElectionSetup.
        const polynomial_degree = Math.max(1, numAuthorities - 2);

        await blockchainService.finalizeElectionSetup(election_id, polynomial_degree, root, faceDatabaseHash);

        console.log(`Merkle Root generated and finalized for ${election_id}: ${root}`);
        console.log(`Face Database Hash: ${faceDatabaseHash}`);
        console.log(`Election Crypto params set: Authorities=${numAuthorities}, Degree=${polynomial_degree} (Blockchain will set Threshold=${polynomial_degree + 1})`);

    } catch (error) {
        console.error(`Error generating Merkle Root for ${election_id}:`, error);
    }
};


exports.createElection = async (req, res) => {
    try {
        const { election_id, election_name } = req.body;
        // creator_name comes from the authenticated token
        const creator_name = req.username;
        const username = req.username; // For admin wallet creation

        // [BLOCKCHAIN MIGRATION] Step 1: Check if election exists on blockchain
        const existingElection = await blockchainService.getElectionDetails(election_id);

        // Check if initialized (assuming existingElection is the struct returned by ethers)
        // If it returns defaults for non-existent key, initialized will be false.
        if (existingElection && existingElection.initialized) {
            return res.status(400).json({ message: 'Election ID already exists on blockchain' });
        }

        // [BLOCKCHAIN MIGRATION] Step 2: Create on chain if not used
        await blockchainService.createElectionOnChain(election_id, election_name, creator_name);

        // [DATABASE SYNC] We MUST save to local DB to support foreign keys (like RegistrationToken)
        // and for easier querying of off-chain data (start times etc if not fully on chain yet)
        await Election.upsert({
            election_id,
            election_name,
            creator_name,
            status: 'created'
        });

        // Add creator as Admin in Wallet table
        // Use findOrCreate to avoid unique constraint error if already exists
        const [adminWallet, created] = await Wallet.findOrCreate({
            where: { username, election_id, role: 'admin' },
            defaults: {
                username,
                election_id,
                role: 'admin'
            }
        });

        res.status(201).json({ message: 'Election created successfully on Blockchain and Local DB' });
    } catch (error) {
        console.error("Error creating election:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.completeSetup = async (req, res) => {
    try {
        const { election_id } = req.body;
        // creator_name comes from the authenticated token potentially needed for verification

        /* [DATABASE DEPRECATION]
        const election = await Election.findByPk(election_id);
        if (!election) return res.status(404).json({ message: 'Election not found' });

        election.status = 'registration';
        await election.save();
        */

        // [BLOCKCHAIN MIGRATION] Check existence on chain
        const onChainDetails = await blockchainService.getElectionDetails(election_id);
        if (!onChainDetails || !onChainDetails.initialized) {
            return res.status(404).json({ message: 'Election not found on blockchain' });
        }

        // Start Merkle Root generation immediately
        // This will now trigger the blockchain finalization
        await generateMerkleRoot(election_id);

        res.json({ message: 'Registration started and Merkle Root generated (Blockchain finalized).' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.setupElection = async (req, res) => {
    try {
        const { election_id, candidates, start_time, end_time, result_time, authorities } = req.body;
        // creator_name comes from the authenticated token
        const creator_name = req.username;

        // [BLOCKCHAIN MIGRATION] Step 1: Verify Creator and Existence on Chain
        const onChainDetails = await blockchainService.getElectionDetails(election_id);

        if (!onChainDetails || !onChainDetails.initialized) {
            return res.status(404).json({ message: 'Election not found on blockchain' });
        }

        if (onChainDetails.creatorName !== creator_name) {
            return res.status(403).json({ message: 'Unauthorized: Only the creator can setup the election.' });
        }

        if (onChainDetails.setupDone) {
            return res.status(400).json({ message: 'Election already setup on blockchain' });
        }

        // [BLOCKCHAIN MIGRATION] Step 2: Verify Authorities Uniqueness on Chain
        // Fetch current on-chain authorities to ensure we aren't adding duplicates
        const onChainAuthorities = await blockchainService.getAuthorities(election_id);
        // onChainAuthorities is an array of structs/arrays. We need to check names.
        // Assuming the struct has authorityName property.

        const existingAuthNames = new Set(onChainAuthorities.map(a => a.authorityName));

        // Check incoming authorities
        if (authorities && authorities.length > 0) {
            for (const auth of authorities) {
                if (existingAuthNames.has(auth.username)) {
                    console.warn(`[Blockchain Check] Authority ${auth.username} already exists on chain.`);
                    // Depending on requirements, we might skip or error. 
                    // The prompt says "if no call that setupElectiononchain".
                    // So if YES (exists), we should probably stop or skip. 
                    // Let's assume strict check: fail if duplicate.
                    return res.status(400).json({ message: `Authority ${auth.username} already exists on blockchain.` });
                }
            }
        }

        /* [DATABASE DEPRECATION]
        const election = await Election.findByPk(election_id);
        if (!election) return res.status(404).json({ message: 'Election not found' });

        // Update election details
        election.start_time = start_time;
        election.end_time = end_time;
        election.result_time = result_time;

        await election.save();

        // Store Authority Wallets
        if (authorities && authorities.length > 0) {
            // Start ID from 2 because Admin is ID 1
            let authCounter = 2;

            for (const auth of authorities) {
                if (auth.username) {
                    // Check if wallet exists
                    const existingWallet = await Wallet.findOne({
                        where: {
                            username: auth.username,
                            election_id
                        }
                    });

                    if (existingWallet) {
                        // Check if wallet exists with admin role
                        const existingAdminWallet = await Wallet.findOne({
                            where: {
                                username: auth.username,
                                election_id,
                                role: 'admin' // Explicitly check for admin role
                            }
                        });

                        if (existingAdminWallet) {
                            console.warn(`[Constraint Violation] User ${auth.username} is Admin. Cannot be Authority.`);
                            continue;
                        }

                        // Check if already Authority (prevent duplicates)
                        const existingAuthRole = await Wallet.findOne({
                            where: {
                                username: auth.username,
                                election_id,
                                role: 'authority'
                            }
                        });
                        if (existingAuthRole) {
                            console.log(`Debug: User ${auth.username} already has authority role. Skipping.`);
                            continue;
                        }
                    }

                    // Create Authority Role
                    console.log(`Debug: Creating Authority ${authCounter} for ${auth.username}`);
                    await Wallet.create({
                        username: auth.username,
                        election_id,
                        role: 'authority',
                        authority_id: authCounter++
                    });
                }
            }
        }
        */
        if (candidates && candidates.length > 0) {
            const candidateData = candidates.map(c => ({
                election_id,
                candidate_name: c.candidate_name,
                symbol_name: c.symbol_name
            }));
            await Candidate.bulkCreate(candidateData);
        }

        // res.json({ message: 'Election setup updated', election });

        // ------------------------------------------------------------------
        // [BLOCKCHAIN] Sync Setup with Smart Contract (Phase 2)
        // ------------------------------------------------------------------
        try {
            // 1. Prepare Data for Blockchain
            const toUnix = (date) => Math.floor(new Date(date).getTime() / 1000);

            // Extract Candidate Names
            const candidateNames = (candidates || []).map(c => c.candidate_name);

            // Extract Authority Names (excluding Admin who is Creator/Auth 1)
            const authorityNames = (authorities || []).map(a => a.username);

            const setupData = {
                electionId: election_id,
                startTime: toUnix(start_time),
                endTime: toUnix(end_time),
                resultTime: toUnix(result_time),
                threshold: 3, // Hardcoded as per request
                candidateNames: candidateNames,
                authorityNames: authorityNames
            };

            // Call Blockchain Service
            await blockchainService.setupElectionOnChain(setupData);

            console.log(`[Blockchain] Setup synced for ${election_id}`);

            // ------------------------------------------------------------------
            // [BLOCKCHAIN] Verify Storage (User Request)
            // ------------------------------------------------------------------
            /*
            console.log("---------------------------------------------------");
            console.log("[Blockchain Debug] Verifying On-Chain Storage...");

            const onChainDetails = await blockchainService.getElectionDetails(election_id);
            const onChainAuthorities = await blockchainService.getAuthorities(election_id);
            
            // ... logging code ...
            */

            res.json({ message: 'Election setup synced to blockchain' });

        } catch (bcError) {
            console.error("[Blockchain] Setup Sync Failed:", bcError.message);
            res.status(500).json({ message: bcError.message });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.startRegistration = async (req, res) => {
    try {
        const { election_id } = req.body;
        const election = await Election.findByPk(election_id);
        if (!election) return res.status(404).json({ message: 'Election not found' });

        election.status = 'registration';
        await election.save();
        res.json({ message: 'Registration started', election });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.closeRegistration = async (req, res) => {
    try {
        const { election_id } = req.body;
        await generateMerkleRoot(election_id);
        res.json({ message: 'Registration closed manually' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMerkleRoot = async (req, res) => {
    try {
        const { election_id } = req.params;
        const election = await Election.findByPk(election_id);
        if (!election) return res.status(404).json({ message: 'Election not found' });

        res.json({ merkle_root: election.merkle_root });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMerkleWitness = async (req, res) => {
    try {
        const { election_id, commitment } = req.body;

        const tokens = await RegistrationToken.findAll({
            where: {
                election_id,
                status: 'used'
            }
        });

        const commitments = tokens.map(t => t.commitment).filter(c => c);
        const merkleService = new MerkleTreeService(commitments);
        await merkleService.build();

        const proof = merkleService.getProof(commitment);

        res.json({ proof });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getElection = async (req, res) => {
    try {
        const { election_id } = req.params;
        const election = await Election.findByPk(election_id, {
            include: [{ model: ElectionCrypto }]
        });
        if (!election) return res.status(404).json({ message: 'Election not found' });

        // Retrieve election details from blockchain to get the election public key
        const bcDetails = await blockchainService.getElectionDetails(election_id);

        let bcElectionPK = null;
        if (bcDetails && bcDetails.electionPublicKey && bcDetails.electionPublicKey !== '0x') {
            bcElectionPK = bcDetails.electionPublicKey;
        }

        // [BLOCKCHAIN MIGRATION] Get the mathematically authoritative Tally
        const blockchainTally = await blockchainService.getEncryptedTally(election_id);

        const responseObj = election.toJSON();

        // Synthesize the ElectionCrypto part so the frontend can receive the PK seamlessly
        responseObj.ElectionCrypto = responseObj.ElectionCrypto || {};
        if (bcElectionPK) {
            responseObj.ElectionCrypto.election_pk = bcElectionPK;
        }

        // Override local DB tally with the blockchain's official flat array split
        if (blockchainTally && blockchainTally.c1.length > 0) {
            responseObj.encrypted_tally = blockchainTally; // Sets it to { c1: [], c2: [] } Object directly
            // Note: The frontend AuthorityDecryption.jsx handles `typeof tally === 'string' ? JSON.parse(tally) : tally;`
            // So assigning the raw JS object here is perfectly safe and preferred.
        }

        res.json(responseObj);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getElectionsByWallet = async (req, res) => {
    try {
        const username = req.username; // From JWT token

        // Fetch directly from Blockchain Events (ElectionCreated event)
        const elections = await blockchainService.getElectionsByCreator(username);

        res.json(elections);
    } catch (error) {
        console.error("Error fetching admin elections from blockchain:", error);
        res.status(500).json({ message: error.message });
    }
};


exports.getParticipatingElections = async (req, res) => {
    try {
        const username = req.username || req.params.username;

        // ── 1. Voter elections: check ElectionVoter table ────────────────────
        const voterRows = await ElectionVoter.findAll({
            where: { username },
            attributes: ['election_id']
        });
        const voterElectionIds = new Set(voterRows.map(r => String(r.election_id)));

        // ── 2. Authority elections: query blockchain ElectionCreated events ──
        // Then verify username is actually listed in getAuthorities per election.
        const authorityMap = {}; // electionId -> authorityId (Number)

        try {
            const filter = blockchainService.contract.filters.ElectionCreated();
            const events = await blockchainService.contract.queryFilter(filter);

            for (const event of events) {
                const electionId = String(event.args[0]);
                try {
                    const authorities = await blockchainService.getAuthorities(electionId);
                    const match = authorities.find(a => a.authorityName === username);
                    if (match) {
                        authorityMap[electionId] = Number(match.authorityId);
                    }
                } catch (e) {
                    // skip individual bad elections
                }
            }
        } catch (err) {
            console.warn('[Participating] Could not query blockchain events:', err.message);
        }

        const authorityElectionIds = new Set(Object.keys(authorityMap).map(String));

        // ── 3. Merge all unique election IDs ────────────────────────────────
        const allIds = [...new Set([...voterElectionIds, ...authorityElectionIds])];

        if (allIds.length === 0) return res.json([]);

        // ── 4. Fetch blockchain details for each election ───────────────────
        const now = Math.floor(Date.now() / 1000); // unix seconds
        const results = [];

        for (const electionId of allIds) {
            try {
                const details = await blockchainService.getElectionDetails(electionId);

                const startUnix = details ? Number(details.startTime) : 0;
                const endUnix = details ? Number(details.endTime) : 0;

                // Determine role
                const isVoter = voterElectionIds.has(String(electionId));
                const isAuthority = authorityElectionIds.has(String(electionId));
                const user_role = (isVoter && isAuthority) ? 'both'
                    : isAuthority ? 'authority'
                        : 'voter';

                // Determine status from blockchain times
                let status;
                if (startUnix === 0 || endUnix === 0) {
                    status = 'upcoming'; // not yet configured
                } else if (startUnix > now) {
                    status = 'upcoming';
                } else if (endUnix > now) {
                    status = 'ongoing';
                } else {
                    status = 'completed';
                }

                results.push({
                    election_id: electionId,
                    election_name: details ? details.electionName : electionId,
                    creator_name: details ? details.creatorName : '',
                    start_time: startUnix > 0 ? new Date(startUnix * 1000).toISOString() : null,
                    end_time: endUnix > 0 ? new Date(endUnix * 1000).toISOString() : null,
                    status,
                    user_role,
                    my_authority_id: authorityMap[electionId] ?? null
                });
            } catch (err) {
                console.warn(`[Participating] Failed to get details for ${electionId}:`, err.message);
            }
        }

        res.json(results);

    } catch (error) {
        console.error('Error fetching participating elections:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};




exports.getElectionCommitments = async (req, res) => {
    try {
        const { election_id } = req.params;

        // 1. Fetch Election from Blockchain for Merkle Root
        const bcDetails = await blockchainService.getElectionDetails(election_id);
        if (!bcDetails || !bcDetails.initialized) {
            return res.status(404).json({ success: false, message: 'Election not found on blockchain' });
        }

        const merkle_root = bcDetails.registrationMerkleRoot || '0x';

        // 2. Fetch ALL used tokens for this election
        const tokens = await RegistrationToken.findAll({
            where: {
                election_id,
                status: 'used'
            }
        });

        // 3. Extract and SORT commitments (Must match backend generation logic)
        const commitments = tokens
            .map(t => t.commitment)
            .filter(c => c)
            .sort();

        console.log(`[API] Serving ${commitments.length} commitments for ${election_id}`);

        res.json({
            success: true,
            election_id,
            merkle_root,
            commitments
        });

    } catch (error) {
        console.error("Error fetching election commitments:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCandidatesByElection = async (req, res) => {
    try {
        const { election_id } = req.params;
        const candidates = await Candidate.findAll({
            where: { election_id }
        });

        if (candidates && candidates.length > 0) {
            return res.json(candidates);
        }

        // Fallback to blockchain if candidates table is empty
        const bcDetails = await blockchainService.getElectionDetails(election_id);
        if (bcDetails && bcDetails.candidateNames && bcDetails.candidateNames.length > 0) {
            const bcCandidates = bcDetails.candidateNames.map((name, index) => ({
                id: index + 1,
                election_id,
                candidate_name: name,
                symbol_name: "U/A" // Unknown/Auto for blockchain generic symbols
            }));
            return res.json(bcCandidates);
        }

        res.json([]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// [BLOCKCHAIN] Fetch final results from smart contract
exports.getFinalResult = async (req, res) => {
    try {
        const { election_id } = req.params;
        const result = await blockchainService.contract.getFinalResult(election_id);

        const candidates = result[0]; // string[]
        const counts = result[1];     // BigInt[]

        const data = candidates.map((name, i) => ({
            candidate_name: name,
            vote_count: Number(counts[i])
        }));

        res.json(data);
    } catch (error) {
        console.error('[Result] Error fetching final result from blockchain:', error);
        res.status(500).json({ message: error.message });
    }
};
