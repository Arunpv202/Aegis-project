const db = require('../models');
const User = db.User;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const { name, voter_id, dob, username, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            where: {
                [db.Sequelize.Op.or]: [{ username }, { voter_id }]
            }
        });

        if (existingUser) {
            return res.status(400).send({ message: "Username or Voter ID already exists!" });
        }

        // Hash password (the input 'password' is expected to be a client-side hash, we hash it again for storage)
        const password_hash = await bcrypt.hash(password, 10);

        await User.create({
            name,
            voter_id,
            dob,
            username,
            password_hash
        });

        res.send({ message: "User registered successfully!" });
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).send({ message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ where: { username } });

        if (!user) {
            return res.status(404).send({ message: "User Not found." });
        }

        const passwordIsValid = await bcrypt.compare(password, user.password_hash);

        if (!passwordIsValid) {
            return res.status(401).send({
                message: "Invalid Password!"
            });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'secret-key', {
            expiresIn: "15d" // 15 days as per prompt
        });

        // Set Cookie
        res.cookie("jwt", token, {
            maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days in MS
            httpOnly: true, // Prevent XSS
            sameSite: "strict", // Prevent CSRF
            secure: process.env.NODE_ENV !== "development", // HTTPS only in prod
        });

        res.status(200).send({
            id: user.id,
            username: user.username,
            name: user.name,
            accessToken: token
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).send({ message: error.message });
    }
};

exports.logout = (req, res) => {
    res.clearCookie("jwt", {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV !== "development"
    });
    res.status(200).send({ message: "Logged out successfully" });
};
