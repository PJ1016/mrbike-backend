/* eslint-disable max-len */
const jwt = require("jsonwebtoken");
const jwt_decode = require("jwt-decode");
const Dealer = require("../models/Dealer");

function verifyToken(req, res, next) {
  const { token } = req.headers;

  if (!token) {
    return res
      .status(401)
      .json({ status: false, message: "Token not provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

async function verifyUser(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized. Login first." });
  }

  try {
    const data = jwt_decode(token);

    if (!data || !data.mobile) {
      return res.status(400).json({
        success: false,
        message: "Invalid token data: missing mobile",
      });
    }

    const user = await Dealer.findOne({ mobile: data.mobile });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found with this mobile number",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("verifyUser error:", error);
    return res
      .status(401)
      .json({ status: 401, message: "Authentication failed" });
  }
}

module.exports = { verifyToken, verifyUser };
