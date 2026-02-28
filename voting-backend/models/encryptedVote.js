module.exports = (sequelize, DataTypes) => {
    const EncryptedVote = sequelize.define('EncryptedVote', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        election_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        nullifier: {
            type: DataTypes.STRING,
            allowNull: false
        },
        // We store C1 and C2 as JSON arrays of hex strings
        c1: {
            type: DataTypes.JSON,
            allowNull: false
        },
        c2: {
            type: DataTypes.JSON,
            allowNull: false
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'encrypted_votes',
        indexes: [
            {
                unique: true,
                fields: ['election_id', 'nullifier']
            }
        ]
    });
    return EncryptedVote;
};
