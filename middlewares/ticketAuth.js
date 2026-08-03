const mongoose = require("mongoose");
const Ticket = require("../models/ticket_model");
const { authenticateActor } = require("./bookingAuth");

async function requireOwnTicketList(req, res, next) {
  const actor = await authenticateActor(req, res);
  if (!actor) return;
  if (actor.role === "admin" || String(req.params.user_id) === actor.id) {
    req.auth = actor;
    req.user_id = actor.id;
    return next();
  }
  return res.status(403).json({ success: false, message: "Access denied" });
}

function requireTicketParticipant(paramName = "ticket_id") {
  return async function (req, res, next) {
    const actor = await authenticateActor(req, res);
    if (!actor) return;
    const id = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid ticket ID" });
    const ticket = await Ticket.findById(id).select("user_id").lean();
    if (!ticket || (actor.role !== "admin" && String(ticket.user_id) !== actor.id)) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }
    req.auth = actor;
    req.user_id = actor.id;
    return next();
  };
}

module.exports = { requireOwnTicketList, requireTicketParticipant };
