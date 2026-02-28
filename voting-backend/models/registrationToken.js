module.exports = (sequelize, DataTypes) => {
    const RegistrationToken = sequelize.define('RegistrationToken', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        token: {
            type: DataTypes.STRING,
            allowNull: false // Removed unique constraint to avoid exceeding MySQL's index limit
        },
        election_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        voter_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        commitment: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('unused', 'used'),
            defaultValue: 'unused'
        },
        used_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['token', 'election_id'] // Composite unique constraint
            }
        ]
    });
    return RegistrationToken;
};
