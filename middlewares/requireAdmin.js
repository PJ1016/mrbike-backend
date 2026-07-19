const jwt = require("jsonwebtoken");
const Admin = require("../models/admin_model");

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return req.headers.token || null;
}

// Verifies the JWT signature, then re-checks the caller against the live
// Admin collection (existence + status) instead of trusting claims baked
// into the token payload. Supports both admin token shapes issued by this
// codebase: {user_id, type, user_type} from generateUserToken, and {id, role}
// from adminAuth.verifyOtp.
//
// generateUserToken() is shared by every login flow (admin, customer,
// dealer) and produces the same {user_id, type, user_type} shape for all of
// them - a customer token is {user_id, type: "logged", user_type: 4}, which
// is indistinguishable from an admin token ({user_id, type: "logged",
// user_type: 1|2}) by shape alone. Without checking user_type, a non-admin
// "logged" token reaches Admin.findById() and (almost always) fails with
// the misleading "Admin account not found" - read as "your admin account
// was deleted" when it actually means "this was never an admin token".
// Reject those up front with an accurate message instead.
const ADMIN_USER_TYPES = [1, 2];

async function requireAdmin(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Token not provided" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: "Authentication failed" });
  }

  const adminId = decoded.user_id || decoded.id;
  if (!adminId) {
    return res.status(401).json({ success: false, message: "Authentication failed" });
  }

  if (decoded.user_id && !ADMIN_USER_TYPES.includes(decoded.user_type)) {
    return res.status(403).json({ success: false, message: "This token does not belong to an admin account" });
  }

  try {
    const adminDoc = await Admin.findById(adminId);
    if (!adminDoc) {
      return res.status(403).json({ success: false, message: "Admin account not found" });
    }
    if (adminDoc.status !== "active") {
      return res.status(403).json({ success: false, message: "Admin account is inactive" });
    }

    req.admin = adminDoc;
    req.admin_id = adminDoc._id;
    req.admin_role = adminDoc.role;
    return next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({ success: false, message: "Authorization check failed" });
  }
}

module.exports = { requireAdmin };
