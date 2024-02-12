import jwt from "jsonwebtoken";
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token == null) {
        return res.status(401).json({ error: "No Access Token provided" });
    }

    jwt.verify(token, process.env.SECRET_ACCESS_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid Access Token" });
        }
        req.user = user.id;
        next();
    });
};

export default verifyJWT;
