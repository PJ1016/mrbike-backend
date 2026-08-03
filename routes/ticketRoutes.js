const express = require("express");
const router = express.Router();
const {
    createTicket,
    replyToTicket,
    getMyTickets,
    getAllUserAndDealerTickets,
    updateTicketStatus,
    getTicketById,
    getSupportUnreadCount,
    markTicketRead
} = require("../controller/ticketController");
const { requireAdmin } = require("../middlewares/requireAdmin");
const { requireCustomer, requireOwnCustomerParam } = require("../middlewares/customerAuth");
const { requireOwnTicketList, requireTicketParticipant } = require("../middlewares/ticketAuth");

router.post("/create/:user_id", requireCustomer, requireOwnCustomerParam("user_id"), createTicket);
router.post("/reply/:ticket_id", requireTicketParticipant("ticket_id"), replyToTicket);
router.get("/my-tickets/:user_id", requireOwnTicketList, getMyTickets);
router.get("/user-dealer", requireAdmin, getAllUserAndDealerTickets);
router.post("/status/:ticket_id", requireTicketParticipant("ticket_id"), updateTicketStatus);
router.get("/tickets/:ticket_id", requireTicketParticipant("ticket_id"), getTicketById);
router.get("/unread-count", requireAdmin, getSupportUnreadCount);
router.post("/mark-read/:ticket_id", requireAdmin, markTicketRead);

module.exports = router;
