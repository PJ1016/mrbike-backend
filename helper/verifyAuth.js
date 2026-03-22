/* eslint-disable max-len */
const jwt = require("jsonwebtoken");
const jwt_decode = require("jwt-decode");
const Dealer = require("../models/Dealer");

/**
 * Verify Token
 * Supports two token types:
 *   1. Backend-issued JWT (signed with JWT_SECRET) — standard flow
 *   2. Google-issued JWT — used when admin logs in via Google OAuth
 */
function verifyToken(req, res, next) {
  const { token } = req.headers;

  if (!token) {
    return res
      .status(401)
      .json({ status: false, message: "Token not provided" });
  }

  // 1. Try to verify as a backend-issued JWT first
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded) {
      req["user_id"] = decoded.user_id;
      req["type"] = decoded.type;
      req["user_type"] = decoded.user_type;
      return next();
    }
  } catch (backendJwtError) {
    // Not a backend JWT — fall through to try Google JWT
  }

  // 2. Try to decode as a Google JWT (only decode, Google's signature is not verifiable here)
  try {
    const decodeDep = jwt_decode.jwtDecode || jwt_decode.default || jwt_decode;
    const decoded = decodeDep(token);

    if (!decoded || !decoded.email) {
      return res
        .status(401)
        .json({ status: false, message: "Authentication Failed" });
    }

    // Treat Google admin as a super-admin
    req["user_id"] = decoded.sub;
    req["type"] = "logged";
    req["user_type"] = 1;
    return next();
  } catch (googleJwtError) {
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
