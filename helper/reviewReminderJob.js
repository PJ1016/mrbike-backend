const Booking = require("../models/Booking");
const Customer = require("../models/customer_model");
const { sendBookingNotification } = require("./pushNotification");

const HOUR = 60 * 60 * 1000;
let timer;

async function sendDue(field, minAgeHours, title, body) {
  const now = new Date();
  const due = await Booking.find({ reviewStatus: "pending", reviewEligibleAt: { $lte: new Date(now.getTime() - minAgeHours * HOUR) }, [field]: null }).select("_id user_id").limit(100).lean();
  for (const booking of due) {
    // Claim atomically before sending so overlapping processes cannot duplicate.
    const claimed = await Booking.findOneAndUpdate({ _id: booking._id, reviewStatus: "pending", [field]: null }, { $set: { [field]: now } });
    if (!claimed) continue;
    const customer = await Customer.findById(booking.user_id).select("device_token ftoken").lean();
    await sendBookingNotification({ token: customer?.device_token || customer?.ftoken, title, body, data: { type: "review_request", bookingId: String(booking._id) }, receiverId: booking.user_id, receiverType: "user", bookingId: booking._id });
  }
}

async function run() {
  try {
    await sendDue("reviewReminder24hSentAt", 24, "Your feedback matters", "Tell us how your bike service went.");
    await sendDue("reviewReminder3dSentAt", 72, "Last call for feedback", "Rate your MR Bike Doctor experience in a few taps.");
  } catch (error) { console.error("[REVIEW-REMINDER]", error.message); }
}

function start() { if (timer) return; run(); timer = setInterval(run, 15 * 60 * 1000); timer.unref?.(); }
module.exports = { start, run };
