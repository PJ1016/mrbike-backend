const router = require("express").Router();
const { createS3Upload } = require("../utils/s3Upload");
const { requireCustomer } = require("../middlewares/customerAuth");
const { requireAdmin } = require("../middlewares/requireAdmin");
const { requireAdminOrOwnDealer } = require("../middlewares/sharedAuth");
const controller = require("../controller/ratingController");
const rateLimit = require("express-rate-limit");

const upload = createS3Upload("review-images");
const ownDealer = requireAdminOrOwnDealer(req => req.params.dealerId);
const reviewSubmitLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many review attempts. Please try again later." } });

// Public/future website APIs (published reviews only).
router.get("/list", controller.getallreview);
router.get("/aggregate", controller.aggregateRating);
router.get("/dealer/:dealerId/public", controller.getallreview);

// Customer booking lifecycle.
router.get("/booking/:bookingId/eligibility", requireCustomer, controller.eligibility);
router.post("/add", reviewSubmitLimit, requireCustomer, upload.array("images", 5), controller.addreview);
router.put("/:id", requireCustomer, upload.array("images", 5), controller.updateReview);

// Dealer dashboard/profile. A dealer can only access their own dealer id.
router.get("/dealer/:dealerId", ownDealer, controller.dealerReviews);
router.post("/:id/dealer-reply/:dealerId", ownDealer, controller.reply);

// Admin moderation and analytics.
router.get("/admin/analytics", requireAdmin, controller.analytics);
router.get("/admin/export.csv", requireAdmin, controller.exportCsv);
router.get("/admin", requireAdmin, controller.adminList);
router.patch("/admin/:id/moderate", requireAdmin, controller.moderate);
router.post("/admin/:id/reply", requireAdmin, controller.reply);
router.delete("/admin/:id/spam", requireAdmin, controller.removeSpam);

module.exports = router;
