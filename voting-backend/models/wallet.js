module.exports = (sequelize, DataTypes) => {
    const Wallet = sequelize.define('Wallet', {
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        election_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        role: {
            type: DataTypes.ENUM('admin', 'voter', 'authority'),
            allowNull: false,
        },
        authority_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        pk: {
            type: DataTypes.STRING,
            allowNull: true
        },
        share: {
            type: DataTypes.STRING,
            allowNull: true
        },
        commitment: {
            type: DataTypes.TEXT, // Store JSON array of commitments
            allowNull: true
        }
    }, {
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['username', 'election_id', 'role']
            }
        ]
    });
    return Wallet;
};
