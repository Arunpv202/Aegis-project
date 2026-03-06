const { ethers } = require('ethers');
dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = 'http://127.0.0.1:8545';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY; // Ensure this is set in .env
const CONTRACT_ADDRESS = '0x717a3ce015a2933d26090bae53e7dd105058e820'; // UPDATED ADDRESS

// Load ABI
const CONTRACT_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/ElectionRegistry.abi.json'), 'utf-8')).abi;

class BlockchainService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, this.provider);
        this.nonceManager = new ethers.NonceManager(this.wallet);
        this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.nonceManager);
    }

    // New: Phase 1 Creation
    async createElectionOnChain(electionId, electionName, creatorName) {
        console.log(`[Blockchain] Creating Election (Phase 1): ${electionId}`);
        try {
            const tx = await this.contract.createElection(
                electionId,
                electionName,
                creatorName
            );
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Election Created.`);
        } catch (error) {
            console.error(`[Blockchain] Error createElection:`, error);
            // Don't throw if already exists (idempotency check manual or via error message)
            if (error.message.includes("Election exists")) {
                console.warn("[Blockchain] Election already exists on chain.");
            } else {
                throw error;
            }
        }
    }

    // New: Phase 2 Setup
    async setupElectionOnChain(data) {
        console.log(`[Blockchain] Setting up Election (Phase 2): ${data.electionId}`);
        try {
            const tx = await this.contract.setupElection(
                data.electionId,
                data.startTime,
                data.endTime,
                data.resultTime,
                data.candidateNames,
                data.authorityNames // List of other authorities (excluding admin/creator)
            );

            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Election Setup Completed.`);

        } catch (error) {
            console.error(`[Blockchain] Error setupElection:`, error);
            if (error.message.includes("Already setup")) {
                console.warn("[Blockchain] Election already setup on chain.");
            } else {
                throw error;
            }
        }
    }

    // New: Phase 3 Finalize Setup (Merkle Root)
    async finalizeElectionSetupOnChain(data) {
        console.log(`[Blockchain] Finalizing Election Setup (Merkle Root): ${data.electionId}`);
        try {
            // function finalizeElectionSetup(string electionId, uint256 polynomial_degree, uint256 threshold, bytes32 registrationMerkleRoot)
            const tx = await this.contract.finalizeElectionSetup(
                data.electionId,
                data.polynomial_degree,
                data.registrationMerkleRoot
            );

            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Election Setup Finalized with Merkle Root.`);

        } catch (error) {
            console.error(`[Blockchain] Error finalizeElectionSetup:`, error);
            throw error;
        }
    }

    // Verification: Get Details
    async getElectionDetails(electionId) {
        try {
            // Assuming the contract has a view function or public mapping
            // checking ABI would be ideal, but standard pattern:
            const details = await this.contract.getElectionDetails(electionId);
            // If it returns a struct, ethers returns an array-like object
            return details;
        } catch (error) {
            console.error(`[Blockchain] Error getElectionDetails:`, error);
            return null;
        }
    }

    // Verification: Get Authorities
    async getAuthorities(electionId) {
        try {
            const authorities = await this.contract.getAuthorities(electionId);
            return authorities;
        } catch (error) {
            console.error(`[Blockchain] Error getAuthorities:`, error);
            return null;
        }
    }
    // New: Trigger Round 1
    async startRound1OnChain(electionId) {
        console.log(`[Blockchain] Starting Round 1 for: ${electionId}`);
        try {
            const tx = await this.contract.setRound1Active(electionId);
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Round 1 Started.`);
        } catch (error) {
            console.error(`[Blockchain] Error startRound1OnChain:`, error);
            throw error;
        }
    }

    // New: Trigger Round 2
    async startRound2OnChain(electionId) {
        console.log(`[Blockchain] Starting Round 2 for: ${electionId}`);
        try {
            const tx = await this.contract.setRound2Active(electionId);
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Round 2 Started.`);
        } catch (error) {
            console.error(`[Blockchain] Error startRound2OnChain:`, error);
            throw error;
        }
    }

    async submitDKGRound2(data) {
        console.log(`[Blockchain] Submitting Round 2 for: ${data.electionId} from ${data.fromAuthorityId}`);
        try {
            const tx = await this.contract.submitDKGRound2(
                data.electionId,
                data.fromAuthorityId,
                data.commitments
            );
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Round 2 Submitted.`);
        } catch (error) {
            console.error(`[Blockchain] Error submitDKGRound2:`, error);
            throw error;
        }
    }

    async submitPartialDecryption(electionId, authorityId, partialdecryptionhash) {
        console.log(`[Blockchain] Submitting Partial Decryption Hash for: ${electionId} from Auth ${authorityId}`);
        try {
            const tx = await this.contract.submitPartialDecryption(electionId, authorityId, partialdecryptionhash);
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Partial Decryption Submitted.`);
        } catch (error) {
            console.error(`[Blockchain] Error submitPartialDecryption:`, error);
            throw error;
        }
    }

    // New: Trigger Decryption Phase

    async getCommitments(electionId, authorityId) {
        try {
            return await this.contract.getCommitments(electionId, authorityId);
        } catch (error) {
            console.error(`[Blockchain] Error getCommitments:`, error);
            throw error;
        }
    }

    async getAuthorityStatus(electionId, authorityId) {
        try {
            return await this.contract.getAuthorityActivity(electionId, authorityId);
        } catch (error) {
            console.error(`[Blockchain] Error getAuthorityStatus:`, error);
            return null;
        }
    }

    async finalizeElectionSetup(electionId, polynomial_degree, registrationMerkleRoot, faceDatabaseHash) {
        console.log(`[Blockchain] Finalizing Election Setup for: ${electionId}`);
        try {
            const tx = await this.contract.finalizeElectionSetup(
                electionId,
                polynomial_degree,
                registrationMerkleRoot,
                faceDatabaseHash || ethers.ZeroHash
            );
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Election Setup Finalized.`);
        } catch (error) {
            console.error(`[Blockchain] Error finalizeElectionSetup:`, error);
            throw error;
        }
    }

    // Helper: Fetch Authority Details incl Commitments
    async getAuthoritiesWithConfig(electionId) {
        // console.log(`[Blockchain] getAuthoritiesWithConfig for ${electionId}`);
        try {
            const authorities = await this.contract.getAuthorities(electionId);
            if (!authorities) return [];

            // Enrich with commitments using getAuthorityActivity
            const enriched = await Promise.all(authorities.map(async (auth, index) => {
                try {
                    // getAuthorityActivity returns (publicKey, r1Done, r2Done, decDone, commitments[])
                    // Ethers v6 returns a Result object (array-like with named properties)
                    const activity = await this.contract.getAuthorityActivity(electionId, auth.authorityId);

                    // Safe access to commitments (might be index 4 or named property)
                    // Checking if valid array
                    let commitments = [];
                    if (activity && activity.commitments) {
                        commitments = activity.commitments;
                    } else if (activity && Array.isArray(activity) && activity.length > 4) {
                        commitments = activity[4];
                    }

                    // Convert bytes commitment to hex strings for frontend
                    const commitmentHexArray = [];
                    if (Array.isArray(commitments)) {
                        for (const c of commitments) {
                            commitmentHexArray.push(c);
                        }
                    }

                    return {
                        // Explicitly map properties (fix for 500 error on Ethers object spread)
                        authorityId: auth.authorityId,
                        authorityName: auth.authorityName,
                        publicKey: auth.publicKey,
                        publicKeyProof: auth.publicKeyProof,

                        commitment: commitmentHexArray.length > 0 ? JSON.stringify(commitmentHexArray) : null,
                        authorityIndex: index,
                        // Add status flags explicitly if auth object doesn't have them but activity does
                        round1Done: activity.round1Done,
                        round2Done: activity.round2Done,
                        decryptionDone: activity.decryptionDone
                    };
                } catch (err) {
                    console.warn(`[Blockchain] Failed to get activity for ${auth.authorityId}:`, err.message);
                    return auth;
                }
            }));
            return enriched;
        } catch (error) {
            console.error(`[Blockchain] Error getAuthoritiesWithConfig:`, error);
            throw error;
        }
    }

    // New: Get Shares for a Receiver
    // New: Get Shares for a Receiver
    async getSharesOnChain(electionId, receiverAuthorityId) {
        try {
            const authorities = await this.contract.getAuthorities(electionId);
            const receiverIndex = authorities.findIndex(a => a.authorityId === receiverAuthorityId);

            if (receiverIndex === -1) return [];

            const shares = [];

            // Loop through all potential senders
            for (let senderIndex = 0; senderIndex < authorities.length; senderIndex++) {
                try {
                    // Mapping: encryptedShares[electionId][senderIndex][receiverIndex]
                    // ABI for public mapping of map(map(map)) usually takes keys in order.
                    // string -> uint256 -> uint256 -> bytes
                    const shareBytes = await this.contract.encryptedShares(electionId, senderIndex, receiverIndex);

                    if (shareBytes && shareBytes !== '0x') {
                        // We also need sender's commitment/pk for verification
                        // Optimization: fetch activity only if share exists
                        const senderActivity = await this.contract.getAuthorityActivity(electionId, authorities[senderIndex].authorityId);
                        const commitments = senderActivity.commitments;

                        shares.push({
                            election_id: electionId,
                            from_authority_id: authorities[senderIndex].authorityId,
                            to_authority_id: receiverAuthorityId,
                            encrypted_share: shareBytes,
                            sender_commitment: commitments.length > 0 ? JSON.stringify(commitments) : null,
                            sender_pk: authorities[senderIndex].publicKey // or senderActivity.publicKey
                        });
                    }
                } catch (err) {
                    // Share might not exist or error
                    // console.debug(`No share from ${senderIndex} to ${receiverIndex}`);
                }
            }
            return shares;
        } catch (error) {
            console.error(`[Blockchain] Error getSharesOnChain:`, error);
            throw error;
        }
    }

    // New: Submit Round 1 (Public Key)
    async submitRound1OnChain(electionId, authorityId, publicKey, publicKeyProof) {
        console.log(`[Blockchain] Submitting Round 1 for ${electionId}, Auth: ${authorityId}`);
        try {
            // ABI: submitDKGRound1(electionId, authorityId, publicKey, publicKeyProof, _round1Hash)
            // Passing ZeroHash for _round1Hash as per user request/ABI mismatch workaround
            const tx = await this.contract.submitDKGRound1(
                electionId,
                authorityId,
                publicKey,
                publicKeyProof
            );
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Round 1 Submitted.`);
        } catch (error) {
            console.error(`[Blockchain] Error submitRound1OnChain:`, error);
            if (error.message.includes("Round1 already done")) {
                console.warn("[Blockchain] Round 1 already submitted for this authority.");
            } else {
                throw error;
            }
        }
    }

    // New: Submit Round 2
    async submitRound2OnChain(data) {
        console.log(`[Blockchain] Submitting Round 2: ${data.electionId} from ${data.fromAuthorityId}`);
        try {
            // ABI: submitDKGRound2(electionId, fromAuthorityId, commitments)
            const tx = await this.contract.submitDKGRound2(
                data.electionId,
                data.fromAuthorityId,
                data.commitments   // bytes[]
            );
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Round 2 Submitted.`);
        } catch (error) {
            console.error(`[Blockchain] Error submitRound2:`, error);
            // Handle "Round2 already done" specifically if needed
            if (error.message.includes("Round2 already done")) {
                console.warn("[Blockchain] Round 2 already submitted for this authority.");
                // Optionally verify if the data matches? For now just warn.
            } else {
                throw error;
            }
        }
    }

    // New: Submit Vote
    async submitVoteOnChain(electionId, nullifier, encryptedVotehash) {
        console.log(`[Blockchain] Submitting Vote for: ${electionId}`);
        try {
            const tx = await this.contract.submitVote(
                electionId,
                nullifier,
                encryptedVotehash
            );
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Vote Submitted.`);
        } catch (error) {
            console.error(`[Blockchain] Error submitVoteOnChain:`, error);
            throw error;
        }
    }

    // New: Set Election Public Key (Finalize DKG)
    async setElectionPublicKeyOnChain(electionId, electionPublicKey) {
        console.log(`[Blockchain] Setting Election Public Key for ${electionId}`);
        try {
            const tx = await this.contract.setElectionPublicKey(electionId, electionPublicKey);
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Election Public Key Set.`);
        } catch (error) {
            console.error(`[Blockchain] Error setElectionPublicKeyOnChain:`, error);
            throw error;
        }
    }

    // New: Publish Encrypted Tally
    async publishEncryptedTally(electionId, encryptedTallyArrays) {
        console.log(`[Blockchain] Publishing Encrypted Tally for ${electionId}`);
        try {
            // encryptedTallyArrays should be an array of byte arrays (hex strings)
            const tx = await this.contract.publishEncryptedTally(electionId, encryptedTallyArrays);
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Encrypted Tally Published Successfully.`);
        } catch (error) {
            console.error(`[Blockchain] Error publishEncryptedTally:`, error);
            throw error;
        }
    }

    // New: Get Elections by Creator (Event Based)
    async getElectionsByCreator(creatorName) {
        console.log(`[Blockchain] Fetching elections for creator: ${creatorName}`);
        try {
            // 1. Query "ElectionCreated" events
            // Event signature: event ElectionCreated(string electionId, string electionName, string creatorName);
            // creatorName is NOT indexed, so we fetch all events and filter in JS.
            const filter = this.contract.filters.ElectionCreated();
            const events = await this.contract.queryFilter(filter);

            console.log(`[Blockchain] Total ElectionCreated events found: ${events.length}`);

            const options = [];
            for (const event of events) {
                // event.args = [electionId, electionName, creatorName]
                const e_creator = event.args[2];
                if (e_creator === creatorName) {
                    options.push({
                        election_id: event.args[0],
                        election_name: event.args[1],
                        creator_name: e_creator
                    });
                }
            }

            console.log(`[Blockchain] Elections matching creator "${creatorName}": ${options.length}`);

            // 2. Fetch latest details for each election (status, times, etc.)
            const detailedElections = [];
            for (const opt of options) {
                try {
                    const details = await this.getElectionDetails(opt.election_id);

                    // Include ALL elections regardless of initialized state.
                    // Uninitialized = only createElection called, not setupElection yet.
                    const startUnix = details ? Number(details.startTime) : 0;
                    const endUnix = details ? Number(details.endTime) : 0;

                    let myAuthorityId = null;
                    if (details && details.initialized) {
                        try {
                            const authorities = await this.getAuthorities(opt.election_id);
                            const authMatch = authorities.find(a => a.authorityName === creatorName);
                            if (authMatch) {
                                // authorityId is BigInt in ethers v6 — convert to Number for JSON serialization
                                myAuthorityId = Number(authMatch.authorityId);
                            }
                        } catch (err) {
                            console.warn(`[Blockchain] Failed to fetch authorities for ${opt.election_id}`, err);
                        }
                    }

                    detailedElections.push({
                        election_id: opt.election_id,
                        election_name: opt.election_name,
                        creator_name: opt.creator_name,
                        start_time: startUnix > 0 ? new Date(startUnix * 1000).toISOString() : null,
                        end_time: endUnix > 0 ? new Date(endUnix * 1000).toISOString() : null,
                        status: details ? this.deriveStatus(startUnix, endUnix) : 'upcoming',
                        initialized: details ? details.initialized : false,
                        setupDone: details ? details.setupDone : false,
                        my_authority_id: myAuthorityId,
                        merkle_root: details ? details.registrationMerkleRoot : null
                    });
                } catch (detailErr) {
                    console.warn(`[Blockchain] Failed to get details for ${opt.election_id}:`, detailErr.message);
                    // Still add with minimal info so UI can show it
                    detailedElections.push({
                        election_id: opt.election_id,
                        election_name: opt.election_name,
                        creator_name: opt.creator_name,
                        start_time: null,
                        end_time: null,
                        status: 'upcoming',
                        initialized: false,
                        setupDone: false,
                        my_authority_id: null,
                        merkle_root: null
                    });
                }
            }

            return detailedElections;

        } catch (error) {
            console.error(`[Blockchain] Error getElectionsByCreator:`, error);
            throw error;
        }
    }

    // New: Fetch and Format Encrypted Tally
    async getEncryptedTally(electionId) {
        // console.log(`[Blockchain] Fetching Encrypted Tally for ${electionId}`);
        try {
            const tallyArray = await this.contract.getEncryptedTally(electionId);

            if (!tallyArray || tallyArray.length === 0) {
                return { c1: [], c2: [] }; // Not tallied yet or zero votes
            }

            // The array is guaranteed to be 2 * MAX_CANDIDATES
            const half = Math.floor(tallyArray.length / 2);

            // Slice into two arrays, remove the '0x' prefix if standard demands (or keep it if your app handles it)
            // tallyWorker.js added '0x'. Most ristretto libraries handle '0x' but VotePage stripped it.
            // We will strip the '0x' to keep consistency with the original `c1` string format.
            const strip0x = (hex) => hex.startsWith('0x') ? hex.slice(2) : hex;

            const c1_strings = tallyArray.slice(0, half).map(strip0x);
            const c2_strings = tallyArray.slice(half).map(strip0x);

            return { c1: c1_strings, c2: c2_strings };
        } catch (error) {
            console.error(`[Blockchain] Error getEncryptedTally:`, error);
            // Fallback empty structure
            return { c1: [], c2: [] };
        }
    }

    // New: Publish Final Results
    async publishFinalResult(electionId, finalCounts) {
        console.log(`[Blockchain] Publishing final results for: ${electionId}`);
        try {
            // Note: finalCounts should be strictly an array of numbers representing counts
            // mapping 1-to-1 to the order of candidates exactly.
            const tx = await this.contract.publishFinalResult(electionId, finalCounts);
            console.log(`[Blockchain] Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`[Blockchain] Final Results Published.`);
        } catch (error) {
            console.error(`[Blockchain] Error publishFinalResult:`, error);
            throw error;
        }
    }

    // New: Get All Elections (Event Based)
    async getAllElectionIds() {
        // console.log(`[Blockchain] Fetching all elections...`);
        try {
            const filter = this.contract.filters.ElectionCreated();
            const events = await this.contract.queryFilter(filter);
            const electionIds = events.map(event => event.args[0]);
            return [...new Set(electionIds)]; // Unique IDs
        } catch (error) {
            console.error(`[Blockchain] Error getAllElectionIds:`, error);
            return [];
        }
    }

    deriveStatus(startUnix, endUnix) {
        const now = Math.floor(Date.now() / 1000);
        if (startUnix > now) return 'upcoming';
        if (startUnix <= now && endUnix > now) return 'ongoing';
        return 'completed';
    }
}

module.exports = new BlockchainService();
