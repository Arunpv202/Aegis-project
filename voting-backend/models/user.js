module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        voter_id: {
            type: DataTypes.STRING(8),
            allowNull: false
            // unique: true // Removed to prevent "Too many keys" error on sync
        },
        dob: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            // unique: true, // Removed to prevent "Too many keys" error on sync
            validate: {
                // strict regex for 6 chars, containing letters and numbers
                is: /^[a-zA-Z0-9]{6}$/
            }
        },
        password_hash: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'users'
    });
    return User;
};
