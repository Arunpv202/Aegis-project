const jwt = require("jsonwebtoken");
const config = process.env; // Or require config file

verifyToken = (req, res, next) => {
    // Check Headers first (Priority for multi-tab testing)
    let token = req.cookies.jwt; // Default fallback

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7, authHeader.length);
    } else if (req.headers['x-access-token']) {
        token = req.headers['x-access-token'];
    }

    if (!token) {
        return res.status(401).send({
            message: "Unauthorized: No Token Provided (Checked Headers & Cookies)"
        });
    }

    jwt.verify(token, config.JWT_SECRET || 'secret-key', (err, decoded) => {
        if (err) {
            return res.status(403).send({ // 403 Forbidden is better for invalid token/expired
                message: "Unauthorized: Invalid Token"
            });
        }
        req.userId = decoded.id;
        req.username = decoded.username;
        next();
    });
};

const authJwt = {
    verifyToken: verifyToken
};
module.exports = authJwt;
