const Sequelize = require('sequelize');
const config = require('../config/database.js');
const db = {};

const sequelize = new Sequelize(config.development.database, config.development.username, config.development.password, {
    host: config.development.host,
    dialect: config.development.dialect,
    logging: config.development.logging
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.User = require('./user')(sequelize, Sequelize); // Added User model
db.Election = require('./election')(sequelize, Sequelize);
db.RegistrationToken = require('./registrationToken')(sequelize, Sequelize);
db.Candidate = require('./candidate')(sequelize, Sequelize);
db.Wallet = require('./wallet')(sequelize, Sequelize);
db.ElectionCrypto = require('./electionCrypto')(sequelize, Sequelize);
db.EncryptedShare = require('./encryptedShare')(sequelize, Sequelize);
db.EncryptedVote = require('./encryptedVote')(sequelize, Sequelize);
db.DecryptionShare = require('./decryptionShare')(sequelize, Sequelize);
db.ElectionVoter = require('./ElectionVoter')(sequelize, Sequelize);

// Associations
db.Election.hasMany(db.Wallet, { foreignKey: 'election_id', sourceKey: 'election_id' });
db.Wallet.belongsTo(db.Election, { foreignKey: 'election_id', targetKey: 'election_id' });

db.EncryptedVote.belongsTo(db.Election, { foreignKey: 'election_id', targetKey: 'election_id' });
db.Election.hasMany(db.EncryptedVote, { foreignKey: 'election_id', sourceKey: 'election_id' });

db.Election.hasOne(db.ElectionCrypto, { foreignKey: 'election_id', sourceKey: 'election_id' });
db.ElectionCrypto.belongsTo(db.Election, { foreignKey: 'election_id', targetKey: 'election_id' });

db.RegistrationToken.belongsTo(db.Election, { foreignKey: 'election_id', targetKey: 'election_id' });
db.Election.hasMany(db.RegistrationToken, { foreignKey: 'election_id', sourceKey: 'election_id' });

db.DecryptionShare.belongsTo(db.Election, { foreignKey: 'election_id', targetKey: 'election_id' });
db.Election.hasMany(db.DecryptionShare, { foreignKey: 'election_id', sourceKey: 'election_id' });

module.exports = db;
