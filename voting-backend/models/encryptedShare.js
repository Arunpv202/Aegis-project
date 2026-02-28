module.exports = (sequelize, DataTypes) => {
    const EncryptedShare = sequelize.define('EncryptedShare', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        election_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        from_authority_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        to_authority_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        encrypted_share: {
            type: DataTypes.TEXT,
            allowNull: false
        }
    }, {
        timestamps: true,
        underscored: true
    });
    return EncryptedShare;
};
