require("dotenv").config();
const db = require("../models");
const Booking = require("../models/Booking");
const Review = require("../models/rating_model");

async function run() {
  await db.mongoose.connect(process.env.DATABASE_URL);
  const reviews = await Review.find({ booking_id: { $ne: null } }).select("_id booking_id createdAt").lean();
  if (reviews.length) await Booking.bulkWrite(reviews.map(r => ({ updateOne: { filter: { _id: r.booking_id }, update: { $set: { reviewStatus: "submitted", reviewId: r._id, reviewSubmittedAt: r.createdAt } } } })));
  const result = await Booking.updateMany({ status: "delivered", billGenerated: true, $or: [{ payment_status: "completed" }, { billStatus: "paid" }], reviewId: null }, { $set: { reviewStatus: "pending" }, $min: { reviewEligibleAt: new Date() } });
  console.log(`Review lifecycle backfill complete: ${result.modifiedCount} eligible bookings updated`);
  await db.mongoose.disconnect();
}
run().catch(error => { console.error(error); process.exitCode = 1; });
