module.exports = (sequelize, DataTypes) => {
    const ElectionCrypto = sequelize.define('ElectionCrypto', {
        election_id: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false
        },
        threshold: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        authority_numbers: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        polynomial_degree: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('setup', 'round1', 'round2', 'completed'),
            defaultValue: 'setup'
        },
        round1_start_time: {
            type: DataTypes.DATE,
            allowNull: true
        },
        round1_end_time: {
            type: DataTypes.DATE,
            allowNull: true
        },
        election_pk: {
            type: DataTypes.STRING,
            allowNull: true
        },
        curve: {
            type: DataTypes.STRING,
            defaultValue: 'Ristretto255'
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'election_crypto'
    });
    return ElectionCrypto;
};
