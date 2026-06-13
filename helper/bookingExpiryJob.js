const Booking = require("../models/Booking");
const Tracking = require("../models/Tracking");
const Customer = require("../models/customer_model");
const { Notification } = require("./pushNotification");

const POLL_INTERVAL_MS = 10 * 1000; // 10 seconds

/**
 * Handles all side-effects for a single booking that has just been atomically
 * marked as expired. Called after the DB write succeeds.
 *
 * @param {import("mongoose").Document} bookingDoc - The updated booking document
 * @param {import("socket.io").Server} io          - Socket.IO server instance
 */
async function expireBooking(bookingDoc, io) {
  const bookingId = bookingDoc._id;

  try {
    // ── 1. Sync Tracking record ──────────────────────────────────────────────
    await Tracking.updateOne(
      { booking_id: bookingId },
      { $set: { status: "expired" } }
    );

    console.log(`[BOOKING-EXPIRY] Booking expired: ${bookingId}`);

    // ── 2. FCM push to user ──────────────────────────────────────────────────
    const customer = await Customer.findById(bookingDoc.user_id).select("device_token ftoken").lean();
    const userToken = customer?.device_token || customer?.ftoken;
    if (userToken) {
      await Notification(
        userToken,
        "Dealer did not respond in time. Please choose another dealer for your booking.",
        bookingDoc.user_id.toString()
      );
    }

    // ── 3. Socket.IO event to user's booking room ────────────────────────────
    if (io) {
      io.to(`booking:${bookingId}`).emit("booking:expired", {
        bookingId,
        message: "Dealer did not respond. Please choose another dealer.",
      });
    }

  } catch (err) {
    console.error(
      `[BOOKING-EXPIRY] Side-effect error for booking ${bookingId}:`,
      err.message
    );
    // Side-effect failure must NOT re-throw — the DB write already succeeded.
  }
}

/**
 * One poll cycle. Atomically claims and processes every booking whose
 * 60-second dealer-response window has closed.
 *
 * Uses a do-while loop so a single tick can drain multiple expired bookings
 * without needing to batch-update (which would skip individual side-effects).
 *
 * @param {import("socket.io").Server} io
 */
async function runExpiryCheck(io) {
  try {
    const now = new Date();

    let expired;
    do {
      // Atomic claim: only transitions a booking that is STILL pending+awaiting.
      // If the dealer accepted/rejected between our query and this update,
      // the condition fails and findOneAndUpdate returns null — no double-expiry.
      expired = await Booking.findOneAndUpdate(
        {
          status: "pending",
          dealerResponseStatus: "awaiting",
          timerExpiresAt: { $lte: now },
        },
        {
          $set: {
            status: "expired",
            dealerResponseStatus: "expired",
          },
        },
        { new: true }
      );

      if (expired) {
        await expireBooking(expired, io);
      }
    } while (expired);

  } catch (err) {
    console.error("[BOOKING-EXPIRY] Poll cycle error:", err.message);
    // Swallow — next tick will retry.
  }
}

/**
 * Start the expiry job. Call this once, after the DB connection is established.
 *
 * @param {import("socket.io").Server} io - Pass the Socket.IO server so future
 *                                          phases can emit real-time events.
 */
function start(io) {
  console.log("[BOOKING-EXPIRY] Expiry job started — polling every 10 seconds");

  // Run immediately so bookings that expired during a server restart
  // are cleaned up right away rather than waiting one full interval.
  runExpiryCheck(io);

  setInterval(() => runExpiryCheck(io), POLL_INTERVAL_MS);
}

module.exports = { start, expireBooking };
