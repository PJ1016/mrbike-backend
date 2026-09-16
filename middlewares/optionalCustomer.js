const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

/**
 * Best-effort customer identification for PUBLIC endpoints.
 *
 * Discovery routes (home feeds, service lists) are deliberately public — the
 * app renders them before sign-in and must keep doing so. But once a rider IS
 * signed in, the backend needs their identity to apply the Phase A rule that
 * discovery is evaluated against ALL their saved bikes, not just whichever one
 * the client happened to put in `bikeId`.
 *
 * So this never rejects: no token, an expired token, a dealer/admin token or a
 * malformed one all simply leave req.user_id unset and the request continues
 * as anonymous. Use requireCustomer (middlewares/customerAuth.js) anywhere the
 * identity is actually load-bearing — this one is a hint, not authorization,
 * and must never guard owned data.
 */
function attachCustomerIfPresent(req, _res, next) {
  const authorization = req.headers.authorization;
  const token =
    authorization && authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : req.headers.token || null;

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (decoded.user_type === 4 && mongoose.Types.ObjectId.isValid(decoded.user_id)) {
      req.user_id = String(decoded.user_id);
      req.user_type = 4;
    }
  } catch (_error) {
    // Anonymous is a valid outcome here, never an error.
  }

  return next();
}

module.exports = { attachCustomerIfPresent };
