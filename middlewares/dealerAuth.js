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
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
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

// Logout-only authentication.
//
// Logout can only ever REMOVE access (force offline, drop the device/FCM
// registration, evict socket rooms), so it must succeed in the two cases the
// stricter middleware above deliberately rejects:
//
//   * expired token — a dealer who opens the app after their 2h token lapsed
//     and taps "Log out" must still be forced offline server-side. Rejecting
//     with 401 would leave them `online: true` with a live device_token and
//     they would keep receiving bookings/pushes on a device that has already
//     wiped its local session.
//   * blocked dealer — a blocked account must still be able to end its session.
//
// The JWT signature is still verified, so this is not an auth bypass: only a
// token this server actually issued for this dealer is accepted.
async function verifyDealerTokenForLogout(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Token not provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
        ignoreExpiration: true,
      });
    } catch (err) {
      return res.status(401).json({ success: false, message: "Authentication failed" });
    }

    const dealerId = decoded.user_id || decoded.id;
    if (!dealerId) {
      return res.status(401).json({ success: false, message: "Authentication failed" });
    }

    const dealer = await Vendor.findById(dealerId);
    if (!dealer) {
      // Nothing left to clean up server-side. Idempotent success so the app
      // still completes its own local teardown and lands on Login.
      return res.status(200).json({ success: true, message: "Logged out" });
    }

    req.dealer = dealer;
    req.dealer_id = dealer._id;
    return next();
  } catch (err) {
    console.error("verifyDealerTokenForLogout error:", err);
    return res.status(500).json({ success: false, message: "Authorization check failed" });
  }
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

function requireOwnDealerBody(fieldName = "dealer_id") {
  return function (req, res, next) {
    const targetId = req.body[fieldName];
    if (targetId != null && String(targetId) !== String(req.dealer_id)) {
      return res.status(403).json({ success: false, message: "You can only manage your own dealer account" });
    }
    req.body[fieldName] = String(req.dealer_id);
    return next();
  };
}

module.exports = { verifyDealerToken, verifyDealerTokenForLogout, requireActiveDealer, requireOwnDealer, requireOwnDealerBody };
