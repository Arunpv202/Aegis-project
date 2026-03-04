const cron = require('node-cron');
const db = require('../models');
const { ristretto255 } = require('@noble/curves/ed25519.js');

const EncryptedVote = db.EncryptedVote;

// Constants (must match frontend/circuit)
const MAX_CANDIDATES = 10;

// Helper to convert Point to Hex
const toHex = (p) => p.toHex();

const runTallyWorker = () => {
    console.log('[TallyWorker] Service Started. Polling Interval: 2 minutes.');

    cron.schedule('* * * * *', async () => {
        try {
            const nowSec = Math.floor(Date.now() / 1000);
            console.log(`[TallyWorker] --------------------------------------------------`);
            console.log(`[TallyWorker] Polling Cycle Start: ${new Date().toISOString()}`);

            const { Op } = require('sequelize');
            const blockchainService = require('../utils/blockchainService');

            // Fetch all known elections directly from the blockchain
            const electionIds = await blockchainService.getAllElectionIds();

            if (electionIds.length === 0) {
                console.log('[TallyWorker] No elections found on blockchain. Waiting...');
            } else {
                console.log(`[TallyWorker] Found ${electionIds.length} elections on blockchain. Checking timelines...`);
            }

            for (const electionId of electionIds) {
                try {
                    const bcDetails = await blockchainService.getElectionDetails(electionId);

                    // Must be fully set up. If setupDone is false, endTime is 0.
                    if (!bcDetails || !bcDetails.initialized || !bcDetails.setupDone) {
                        continue; // Setup not complete on chain
                    }

                    const endUnix = Number(bcDetails.endTime);
                    if (endUnix === 0) continue; // Safety check

                    const now = new Date();

                    // Check if Blockchain End Time + 2 Minute Buffer is strictly crossed
                    if (nowSec >= (endUnix + 120) && !bcDetails.completed) {
                        // Check if a REAL (non-empty) tally already exists on chain.
                        // An empty/blank tally has c1 entries that are all empty strings after stripping '0x'.
                        const existingTally = await blockchainService.getEncryptedTally(electionId);
                        const hasRealTally = existingTally &&
                            existingTally.c1 &&
                            existingTally.c1.length > 0 &&
                            existingTally.c1.some(h => h && h.length > 0); // at least one non-empty hex
                        if (hasRealTally) {
                            continue; // Already processed with real data
                        }

                        console.log(`[TallyWorker] ⚡ Election "${bcDetails.electionName}" (ID: ${electionId}) has ENDED on Blockchain!`);
                        console.log(`[TallyWorker] Reason: EndTime (${new Date(endUnix * 1000).toISOString()}) <= Now (${now.toISOString()})`);
                        await processElectionTally(electionId);
                    }
                } catch (err) {
                    console.error(`[TallyWorker] Error checking blockchain for ${electionId}:`, err.message);
                }
            }
            console.log(`[TallyWorker] Polling Cycle Finished.`);

        } catch (err) {
            console.error('[TallyWorker] CRITICAL ERROR in poll loop:', err);
        }
    });
};

const processElectionTally = async (electionId) => {
    const startTimeData = Date.now();
    console.log(`[TallyWorker] >> Starting Tally Logic for ${electionId}`);

    try {
        // 1. Fetch all encrypted votes
        const votes = await EncryptedVote.findAll({ where: { election_id: electionId } });
        console.log(`[TallyWorker]    Fetched ${votes.length} encrypted votes from DB.`);

        if (votes.length === 0) {
            console.log(`[TallyWorker]    No votes found. Generating and publishing an empty tally (all 0s) to allow election closure.`);
        }

        // 2. Initialize Accumulators
        let C1_Sum = new Array(MAX_CANDIDATES).fill(ristretto255.Point.ZERO);
        let C2_Sum = new Array(MAX_CANDIDATES).fill(ristretto255.Point.ZERO);

        console.log(`[TallyWorker]    Summing up ${votes.length} votes (Candidates: ${MAX_CANDIDATES})...`);

        // 3. Summation
        votes.forEach((vote, idx) => {
            let c1_hex_arr = typeof vote.c1 === 'string' ? JSON.parse(vote.c1) : vote.c1;
            let c2_hex_arr = typeof vote.c2 === 'string' ? JSON.parse(vote.c2) : vote.c2;

            for (let i = 0; i < MAX_CANDIDATES; i++) {
                if (c1_hex_arr[i]) {
                    const p1 = ristretto255.Point.fromHex(c1_hex_arr[i]);
                    C1_Sum[i] = C1_Sum[i].add(p1);
                }
                if (c2_hex_arr[i]) {
                    const p2 = ristretto255.Point.fromHex(c2_hex_arr[i]);
                    C2_Sum[i] = C2_Sum[i].add(p2);
                }
            }
        });

        const c1_strings = C1_Sum.map(p => p.toHex());
        const c2_strings = C2_Sum.map(p => p.toHex());
        // 6. Format and Publish to Blockchain
        const blockchainService = require('../utils/blockchainService');
        const flatEncryptedTally = [];
        c1_strings.forEach(c1 => flatEncryptedTally.push(c1.startsWith('0x') ? c1 : '0x' + c1));
        c2_strings.forEach(c2 => flatEncryptedTally.push(c2.startsWith('0x') ? c2 : '0x' + c2));

        console.log(`[TallyWorker]    Publishing Tally to Blockchain...`);
        await blockchainService.publishEncryptedTally(electionId, flatEncryptedTally);

        const duration = Date.now() - startTimeData;
        console.log(`[TallyWorker] >> SUCCESS: Election ${electionId} marked as ENDED and Published.`);
        console.log(`[TallyWorker]    Tally stored. Calculation time: ${duration}ms.`);

    } catch (error) {
        console.error(`[TallyWorker] >> FAILURE: Could not tally election ${electionId}:`, error);
    }
};

module.exports = runTallyWorker;
