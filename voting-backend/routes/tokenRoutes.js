const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/tokenController');


router.post('/register-user', tokenController.generateTokenForUser); // Admin generates for user
// "Register Voter" is API #4 POST /api/register. 
// This doesn't fit neatly into /api/tokens/register if the prefix is /api/tokens
// We'll handle the prefixes in server.js. This file will handle /generate.
// And maybe we can export the register handler too or put it on a separate route.
// Let's assume server.js mounts this at /api/tokens for generate.
// And we need another route for /api/register.

module.exports = router;
