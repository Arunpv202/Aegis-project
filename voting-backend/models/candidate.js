module.exports = (sequelize, DataTypes) => {
    const Candidate = sequelize.define('Candidate', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        election_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        candidate_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        symbol_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        vote_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        timestamps: false,
        underscored: true
    });
    return Candidate;
};
