const db = require('../models');

async function clearDatabase() {
    try {
        console.log('Disabling Foreign Key Checks...');
        await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        console.log('Truncating Tables...');
        const models = [
            'Candidate',
            'DecryptionShare',
            'Election',
            'ElectionCrypto',
            'ElectionVoter',
            'EncryptedShare',
            'EncryptedVote',
            'RegistrationToken',
            'Wallet'
        ];

        for (const modelName of models) {
            if (db[modelName]) {
                console.log(`Clearing ${modelName}...`);
                await db[modelName].destroy({ where: {}, truncate: true });
            }
        }

        console.log('Enabling Foreign Key Checks...');
        await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✅ Database cleared successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error clearing database:', error);
        process.exit(1);
    }
}

clearDatabase();
