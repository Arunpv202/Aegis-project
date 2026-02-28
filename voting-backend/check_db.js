const db = require('./models');

async function checkDatabase() {
    try {
        // 1. Fetch Elections
        const elections = await db.Election.findAll();
        console.log('\n--- ELECTIONS ---');
        if (elections.length === 0) console.log('No elections found.');
        elections.forEach(e => {
            console.log(JSON.stringify(e.toJSON(), null, 2));
        });

        // 2. Fetch Registration Tokens
        const tokens = await db.RegistrationToken.findAll();
        console.log('\n--- REGISTRATION TOKENS ---');
        if (tokens.length === 0) console.log('No tokens found.');
        tokens.forEach(t => {
            console.log(JSON.stringify(t.toJSON(), null, 2));
        });

        // 3. Fetch Candidates
        const candidates = await db.Candidate.findAll();
        console.log('\n--- CANDIDATES ---');
        if (candidates.length === 0) console.log('No candidates found.');
        candidates.forEach(c => {
            console.log(JSON.stringify(c.toJSON(), null, 2));
        });

    } catch (error) {
        console.error('Error fetching data:', error);
    } finally {
        process.exit();
    }
}

checkDatabase();
