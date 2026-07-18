const jwt = require("jsonwebtoken");
const Vendor = require("../models/dealerModel");

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return req.headers.token || null;
}

// Verifies the JWT signature, then loads the live Vendor document instead of
// trusting the token payload. Returns null (and writes the error response
// itself) when the caller isn't a valid, non-blocked dealer.
async function loadDealerFromToken(req, res) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: "Token not provided" });
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401).json({ success: false, message: "Authentication failed" });
    return null;
  }

  const dealerId = decoded.user_id || decoded.id;
  if (!dealerId) {
    res.status(401).json({ success: false, message: "Authentication failed" });
    return null;
  }

  const dealer = await Vendor.findById(dealerId);
  if (!dealer) {
    res.status(403).json({ success: false, message: "Dealer account not found" });
    return null;
  }
  if (dealer.isBlocked) {
    res.status(403).json({
      success: false,
      message: "Dealer account is blocked",
      reason: dealer.blockedReason,
    });
    return null;
  }

  return dealer;
}

// Any authenticated, non-blocked dealer — including dealers still mid-onboarding
// (registrationStatus Draft/Pending). Use for the dealer's own registration steps.
async function verifyDealerToken(req, res, next) {
  try {
    const dealer = await loadDealerFromToken(req, res);
    if (!dealer) return; // error response already sent

    req.dealer = dealer;
    req.dealer_id = dealer._id;
    return next();
  } catch (err) {
    console.error("verifyDealerToken error:", err);
    return res.status(500).json({ success: false, message: "Authorization check failed" });
  }
}

// Same as verifyDealerToken, additionally requiring the dealer to be approved
// and active (status.isActive). Use for actions that assume a fully
// onboarded, operating dealer (e.g. going online to receive bookings).
async function requireActiveDealer(req, res, next) {
  try {
    const dealer = await loadDealerFromToken(req, res);
    if (!dealer) return;

    if (!dealer.status?.isActive) {
      return res.status(403).json({ success: false, message: "Dealer account is not active" });
    }

    req.dealer = dealer;
    req.dealer_id = dealer._id;
    return next();
  } catch (err) {
    console.error("requireActiveDealer error:", err);
    return res.status(500).json({ success: false, message: "Authorization check failed" });
  }
}

// Must run after verifyDealerToken/requireActiveDealer. Blocks a dealer from
// acting on another dealer's record via a URL param (e.g. /:id, /:dealerId).
function requireOwnDealer(paramName = "id") {
  return function (req, res, next) {
    const targetId = req.params[paramName];
    if (!targetId || !req.dealer_id || targetId !== String(req.dealer_id)) {
      return res.status(403).json({
        success: false,
        message: "You can only manage your own dealer account",
      });
    }
    return next();
  };
}

module.exports = { verifyDealerToken, requireActiveDealer, requireOwnDealer };
