const db = require('../models');
const blockchainService = require('../utils/blockchainService');

const Election = db.Election;
const Candidate = db.Candidate;
const ElectionVoter = db.ElectionVoter;
const EncryptedVote = db.EncryptedVote;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Fetch VoteSubmitted events for a given electionId
// We query the contract filter and match on event.args.electionId
// ─────────────────────────────────────────────────────────────────────────────
async function getVoteEvents(electionId) {
    const filter = blockchainService.contract.filters.VoteSubmitted();
    const events = await blockchainService.contract.queryFilter(filter);
    return events.filter(e => e.args && e.args.electionId === electionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Enrich a VoteSubmitted event with receipt data + on-chain hash
// ─────────────────────────────────────────────────────────────────────────────
async function enrichVoteEvent(event, electionId) {
    try {
        const nullifier = event.args.nullifier;
        const txHash = event.transactionHash;

        // Tx receipt for blockNumber, gasUsed
        const receipt = await blockchainService.provider.getTransactionReceipt(txHash);
        const block = await blockchainService.provider.getBlock(receipt.blockNumber);

        // Encrypted vote hash stored on-chain
        const encHash = await blockchainService.contract.encryptedVotehash(electionId, nullifier);

        return {
            nullifier,
            txHash,
            blockNumber: receipt.blockNumber,
            gasUsed: Number(receipt.gasUsed),
            timestamp: block ? new Date(Number(block.timestamp) * 1000).toISOString() : null,
            encryptedVoteHash: encHash,
        };
    } catch (err) {
        console.warn('[BlockExplorer] enrichVoteEvent error:', err.message);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Fetch candidates from DB (with symbol), fall back to blockchain
// ─────────────────────────────────────────────────────────────────────────────
async function fetchCandidates(electionId) {
    const dbCandidates = await Candidate.findAll({ where: { election_id: electionId } });
    if (dbCandidates && dbCandidates.length > 0) {
        return dbCandidates.map(c => ({
            name: c.candidate_name,
            symbol: c.symbol_name || 'N/A',
        }));
    }
    // Fallback: blockchain only has names
    const details = await blockchainService.getElectionDetails(electionId);
    if (details && details.candidateNames) {
        return details.candidateNames.map(n => ({ name: n, symbol: 'N/A' }));
    }
    return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/blockexplorer/view
// Body: { electionId }
// ─────────────────────────────────────────────────────────────────────────────
exports.viewElection = async (req, res) => {
    try {
        const { electionId } = req.body;
        const username = req.username;

        if (!electionId) {
            return res.status(400).json({ message: 'electionId is required' });
        }

        // 1. Get on-chain election details
        const details = await blockchainService.getElectionDetails(electionId);
        if (!details || !details.initialized) {
            return res.status(404).json({ message: 'Election not found on blockchain' });
        }

        // 2. Determine roles
        const isCreator = details.creatorName === username;
        const authorities = await blockchainService.getAuthorities(electionId);
        const myAuthority = authorities
            ? authorities.find(a => a.authorityName === username)
            : null;
        const isAuthority = !!myAuthority;

        const voterRow = await ElectionVoter.findOne({
            where: { username, election_id: electionId }
        });
        const isVoter = !!voterRow;

        // At least one role must exist
        if (!isCreator && !isAuthority && !isVoter) {
            return res.status(403).json({
                message: 'Access denied: You have no role in this election.'
            });
        }

        // 3. Fetch shared data
        const candidates = await fetchCandidates(electionId);
        const startUnix = Number(details.startTime);
        const endUnix = Number(details.endTime);

        // Fetch election public key (fallback to DB if not on chain or '0x')
        const electionRow = await Election.findByPk(electionId, { include: [{ model: db.ElectionCrypto }] });
        const electionPublicKey = details.electionPublicKey && details.electionPublicKey !== '0x'
            ? details.electionPublicKey
            : (electionRow && electionRow.ElectionCrypto ? electionRow.ElectionCrypto.election_pk : null);

        // Tally hash (if tally was published) -- available to everyone 
        let encryptedTallyTxHash = null;
        let encryptedTallyData = null;
        try {
            const tallyFilter = blockchainService.contract.filters.EncryptedTallyPublished();
            const tallyEvents = await blockchainService.contract.queryFilter(tallyFilter);
            const myTally = tallyEvents.find(e => e.args && e.args.electionId === electionId);
            if (myTally) {
                encryptedTallyTxHash = myTally.transactionHash;
                encryptedTallyData = await blockchainService.getEncryptedTally(electionId);
            }
        } catch { }

        const baseElection = {
            electionId,
            electionName: details.electionName,
            creatorName: details.creatorName,
            registrationMerkleRoot: details.registrationMerkleRoot,
            round1Active: details.round1Active,
            round2Active: details.round2Active,
            completed: details.completed,
            startTime: startUnix > 0 ? new Date(startUnix * 1000).toISOString() : null,
            endTime: endUnix > 0 ? new Date(endUnix * 1000).toISOString() : null,
            candidates,
            electionPublicKey,
            encryptedTallyTxHash,
            encryptedTallyData,
        };

        // ── Authority names list ─────────────────────────────────────────────
        const authorityNames = authorities
            ? authorities.map(a => ({ id: Number(a.authorityId), name: a.authorityName }))
            : [];

        // ── CREATOR VIEW ──────────────────────────────────────────────────────
        if (isCreator) {
            // Authority details with partial-decryption hash
            const authorityDetails = await Promise.all(
                (authorities || []).map(async (auth) => {
                    try {
                        const activity = await blockchainService.contract.getAuthorityActivity(
                            electionId, auth.authorityId
                        );
                        const pdHash = await blockchainService.contract.partialDecryptionhash(
                            electionId, auth.authorityId
                        );
                        return {
                            authorityId: Number(auth.authorityId),
                            authorityName: auth.authorityName,
                            round1Done: activity.round1Done,
                            round2Done: activity.round2Done,
                            decryptionDone: activity.decryptionDone,
                            partialDecryptionHash: pdHash,
                        };
                    } catch {
                        return {
                            authorityId: Number(auth.authorityId),
                            authorityName: auth.authorityName,
                            round1Done: false,
                            round2Done: false,
                            decryptionDone: false,
                            partialDecryptionHash: null,
                        };
                    }
                })
            );

            // Latest 3 vote events
            const voteEvents = await getVoteEvents(electionId);
            // Sort descending by blockNumber
            voteEvents.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
            const latest3 = voteEvents.slice(0, 3);
            const latestVotes = (
                await Promise.all(latest3.map(ev => enrichVoteEvent(ev, electionId)))
            ).filter(Boolean);



            return res.json({
                role: 'creator',
                election: {
                    ...baseElection,
                    numAuthorities: authorityDetails.length,
                    threshold: Number(details.threshold),
                    voteCount: voteEvents.length,
                },
                authorities: authorityDetails,
                latestVotes,
            });
        }

        // ── VOTER + AUTHORITY COMBINED VIEW ───────────────────────────────────
        let voterSection = null;
        let authoritySection = null;

        if (isVoter) {
            // Find this voter's EncryptedVote in DB to get nullifier
            const voteRecord = await EncryptedVote.findOne({
                where: { election_id: electionId }
                // We can't directly query by username since EncryptedVote has no username
                // We rely on ElectionVoter having the nullifier... but it doesn't.
                // Best option: find by matching all vote events for this election
                // and match against the voter's stored record. 
                // Since we don't have nullifier stored per-user in DB with username,
                // we query ALL encrypted votes and return the one whose nullifier 
                // is confirmed to be used by this voter. However, the nullifier is 
                // anonymous by design. 
                // 
                // Practical approach: ElectionVoter doesn't store nullifier.
                // We surface all votes for admin; for voter we show election info 
                // and instruct them to paste their local nullifier to verify.
                // The voter's own vote is identified via their provided nullifier 
                // in the MatchHash flow. Show general election info here.
            });

            voterSection = {
                electionName: details.electionName,
                creatorName: details.creatorName,
                authorityNames,
                candidates,
                // Voter cannot see their own vote without their nullifier
                // They use SearchNullifier / MatchHashModal to verify
                instruction: 'Use your nullifier to search and verify your vote.'
            };
        }

        if (isAuthority) {
            const myAuthId = myAuthority.authorityId;
            const activity = await blockchainService.contract.getAuthorityActivity(
                electionId, myAuthId
            );
            const pdHash = await blockchainService.contract.partialDecryptionhash(
                electionId, myAuthId
            );

            authoritySection = {
                authorityId: Number(myAuthId),
                authorityName: myAuthority.authorityName,
                round1Done: activity.round1Done,
                round2Done: activity.round2Done,
                decryptionDone: activity.decryptionDone,
                partialDecryptionHash: pdHash,
            };
        }

        const role = (isVoter && isAuthority) ? 'both'
            : isVoter ? 'voter' : 'authority';

        return res.json({
            role,
            election: baseElection,
            authorities: authorityNames,
            voterSection,
            authoritySection,
        });

    } catch (error) {
        console.error('[BlockExplorer] viewElection error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/blockexplorer/search
// Body: { electionId, nullifier }
// ─────────────────────────────────────────────────────────────────────────────
exports.searchByNullifier = async (req, res) => {
    try {
        const { electionId, nullifier } = req.body;

        if (!electionId || !nullifier) {
            return res.status(400).json({ message: 'electionId and nullifier are required' });
        }

        // Confirm election exists
        const details = await blockchainService.getElectionDetails(electionId);
        if (!details || !details.initialized) {
            return res.status(404).json({ message: 'Election not found on blockchain' });
        }

        // Filter VoteSubmitted events for this election + nullifier
        const allEvents = await getVoteEvents(electionId);
        const match = allEvents.find(e => e.args && e.args.nullifier === nullifier);

        if (!match) {
            return res.status(404).json({ message: 'No vote found for this nullifier in this election.' });
        }

        const enriched = await enrichVoteEvent(match, electionId);
        if (!enriched) {
            return res.status(500).json({ message: 'Failed to fetch transaction details.' });
        }

        return res.json({
            found: true,
            vote: enriched,
            electionName: details.electionName,
        });

    } catch (error) {
        console.error('[BlockExplorer] searchByNullifier error:', error);
        res.status(500).json({ message: error.message });
    }
};
