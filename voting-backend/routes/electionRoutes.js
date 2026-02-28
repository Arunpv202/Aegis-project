const express = require('express');
const router = express.Router();
const electionController = require('../controllers/electionController');

const { verifyToken } = require('../middleware/authJwt');

router.post('/', verifyToken, electionController.createElection);
router.post('/setup', verifyToken, electionController.setupElection);
router.post('/complete-setup', verifyToken, electionController.completeSetup);
router.post('/start-registration', verifyToken, electionController.startRegistration);
router.post('/close-registration', verifyToken, electionController.closeRegistration);

// Must be BEFORE /:election_id wildcard
router.get('/my-elections', verifyToken, electionController.getElectionsByWallet);
router.get('/participating/:username', verifyToken, electionController.getParticipatingElections);
router.get('/:election_id/merkle-root', electionController.getMerkleRoot);
router.get('/:election_id/commitments', electionController.getElectionCommitments);
router.get('/:election_id', electionController.getElection);
router.get('/:election_id/candidates', electionController.getCandidatesByElection);

// Vote Route
const voteController = require('../controllers/voteController');
router.post('/:election_id/vote', voteController.castVote);

// Decryption Route
const resultController = require('../controllers/resultController');
router.post('/:election_id/decrypt', resultController.submitDecryptionShare);
router.get('/:election_id/decrypt/:authority_id/status', resultController.getDecryptionStatus);

// [BLOCKCHAIN] Final result from smart contract
router.get('/:election_id/final-result', electionController.getFinalResult);

module.exports = router;
