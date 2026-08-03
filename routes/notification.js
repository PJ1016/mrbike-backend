const express = require("express");
const router = express.Router();
const { getNotificationsByReceiverId,deleteNotify } = require("../controller/notificationController");
const { requireCustomer, requireOwnCustomerParam } = require("../middlewares/customerAuth");

// GET /api/notifications/:receiverId
router.get("/:receiverId", requireCustomer, requireOwnCustomerParam("receiverId"), getNotificationsByReceiverId);
router.delete("/:id", requireCustomer, deleteNotify);

module.exports = router;
