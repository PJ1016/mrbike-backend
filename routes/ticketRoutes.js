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

router.post("/create/:user_id", createTicket);
router.post("/reply/:ticket_id", replyToTicket);
router.get("/my-tickets/:user_id", getMyTickets);
router.get("/user-dealer", requireAdmin, getAllUserAndDealerTickets);
router.post("/status/:ticket_id", updateTicketStatus);
router.get("/tickets/:ticket_id", getTicketById);
router.get("/unread-count", requireAdmin, getSupportUnreadCount);
router.post("/mark-read/:ticket_id", requireAdmin, markTicketRead);

module.exports = router;
