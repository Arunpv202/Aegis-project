const db = require('../models');

async function resetSchema() {
    try {
        console.log('Using FORCE sync to drop and recreate tables...');
        await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.sequelize.sync({ force: true });
        await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✅ Database schema reset successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting schema:', error);
        process.exit(1);
    }
}

resetSchema();
