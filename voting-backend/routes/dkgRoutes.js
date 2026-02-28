const express = require('express');
const router = express.Router();
const dkgController = require('../controllers/dkgController');
const { verifyToken } = require('../middleware/authJwt');

router.get('/status/:election_id', dkgController.getDkgStatus);
router.get('/authorities/:election_id', verifyToken, dkgController.getAuthorities);

// Admin Triggers - Should these be admin only? For now, token authentication is a good start.
router.post('/start-round1', verifyToken, dkgController.triggerRound1);
router.post('/start-round2', verifyToken, dkgController.triggerRound2);

// Authority Actions - MUST be authenticated
router.post('/round1/submit', verifyToken, dkgController.submitPublicKey); // Uses token identity
router.post('/round2/submit', verifyToken, dkgController.submitRound2);    // Uses token identity
router.post('/round2/init', verifyToken, dkgController.initRound2);        // Uses token identity
router.post('/verify-authority', verifyToken, dkgController.verifyAuthority);

router.get('/shares/:election_id/:authority_id', dkgController.getShares); // Maybe protect this too? It reveals shares.
router.get('/admin-status/:election_id', dkgController.getAdminStatus);

router.post('/finalize', verifyToken, dkgController.computeElectionKeys);

module.exports = router;
