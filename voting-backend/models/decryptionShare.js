module.exports = (sequelize, DataTypes) => {
    const DecryptionShare = sequelize.define('DecryptionShare', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        election_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        authority_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        // Decryption Share for each candidate component in the vector
        // Format: { c1_components: ["hex1", "hex2", ...] }
        share_data: {
            type: DataTypes.JSON,
            allowNull: false
        },
        // ZK Proof verifying the share was computed correctly
        proof: {
            type: DataTypes.JSON,
            allowNull: false
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'decryption_shares',
        indexes: [
            {
                unique: true,
                fields: ['election_id', 'authority_id']
            }
        ]
    });
    return DecryptionShare;
};
