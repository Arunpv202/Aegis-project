module.exports = (sequelize, DataTypes) => {
    const ElectionVoter = sequelize.define('ElectionVoter', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        election_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['election_id', 'username']
            }
        ]
    });
    return ElectionVoter;
};
