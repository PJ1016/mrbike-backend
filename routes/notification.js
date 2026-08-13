const express = require("express");
const router = express.Router();
const { getNotificationsByReceiverId,deleteNotify } = require("../controller/notificationController");
const { authenticateActor } = require("../middlewares/bookingAuth");

// Any authenticated actor (customer/dealer/admin) viewing/deleting their own
// notifications; the controller scopes the query by role via req.auth.
async function requireOwnNotifications(req, res, next) {
  const actor = await authenticateActor(req, res);
  if (!actor) return;
  if (actor.role !== "admin" && String(req.params.receiverId) !== actor.id) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  req.auth = actor;
  req.user_id = actor.id;
  return next();
}

async function requireAuthenticatedActor(req, res, next) {
  const actor = await authenticateActor(req, res);
  if (!actor) return;
  req.auth = actor;
  req.user_id = actor.id;
  return next();
}

// GET /api/notifications/:receiverId
router.get("/:receiverId", requireOwnNotifications, getNotificationsByReceiverId);
router.delete("/:id", requireAuthenticatedActor, deleteNotify);

module.exports = router;
