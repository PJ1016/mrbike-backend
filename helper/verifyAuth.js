/* eslint-disable max-len */
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const { token } = req.headers;

  if (!token) {
    return res
      .status(401)
      .json({ status: false, message: "Token not provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req["user_id"] = decoded.user_id;
    req["type"] = decoded.type;
    req["user_type"] = decoded.user_type;
    return next();
  } catch (err) {
    return res
      .status(401)
      .json({ status: false, message: "Authentication Failed" });
  }
}

module.exports = { verifyToken };
