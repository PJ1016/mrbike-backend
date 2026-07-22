const jwt = require("jsonwebtoken");
const Admin = require("../models/admin_model");
const Vendor = require("../models/dealerModel");

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return req.headers.token || null;
}

// Same admin-token-shape detection requireAdmin.js uses: {id, role} from
// adminAuth.verifyOtp, or {user_id, type, user_type} from generateUserToken
// with user_type in ADMIN_USER_TYPES. Dealer tokens are always {user_id,
// type: "dealer", user_type} and never carry `id`, so this never misreads a
// dealer token as an admin token.
const ADMIN_USER_TYPES = [1, 2];

// For routes genuinely called by both roles against the same URL (e.g. a
// dealer viewing their own wallet vs. an admin viewing any dealer's wallet).
// Admins get unrestricted access; dealers only pass when getTargetDealerId(req)
// matches their own id, so a dealer token can never read another dealer's data.
function requireAdminOrOwnDealer(getTargetDealerId) {
  return async function (req, res, next) {
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

    const isAdminShapedToken = decoded.id || (decoded.user_id && ADMIN_USER_TYPES.includes(decoded.user_type));

    try {
      if (isAdminShapedToken) {
        const adminId = decoded.user_id || decoded.id;
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
      }

      const dealerId = decoded.user_id || decoded.id;
      if (!dealerId) {
        return res.status(401).json({ success: false, message: "Authentication failed" });
      }

      const dealer = await Vendor.findById(dealerId);
      if (!dealer) {
        return res.status(403).json({ success: false, message: "Dealer account not found" });
      }
      if (dealer.isBlocked) {
        return res.status(403).json({
          success: false,
          message: "Dealer account is blocked",
          reason: dealer.blockedReason,
        });
      }

      const targetId = getTargetDealerId(req);
      if (!targetId || String(dealer._id) !== String(targetId)) {
        return res.status(403).json({
          success: false,
          message: "You can only manage your own dealer account",
        });
      }

      req.dealer = dealer;
      req.dealer_id = dealer._id;
      return next();
    } catch (err) {
      console.error("requireAdminOrOwnDealer error:", err);
      return res.status(500).json({ success: false, message: "Authorization check failed" });
    }
  };
}

module.exports = { requireAdminOrOwnDealer };
