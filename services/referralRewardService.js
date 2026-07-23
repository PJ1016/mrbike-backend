const Customer = require("../models/customer_model");
const Booking = require("../models/Booking");
const ReferralSettings = require("../models/ReferralSettings");
const ReferralTransaction = require("../models/ReferralTransaction");

// Only these two statuses represent a genuinely fulfilled booking — the
// other FINAL_BOOKING_STATUSES entries (cancelled/rejected/expired) must
// never count toward "first completed booking" or trigger a reward.
const COMPLETED_BOOKING_STATUSES = ["completed", "delivered"];

async function getReferralSettingsSingleton() {
  let settings = await ReferralSettings.findOne({});
  if (!settings) settings = await ReferralSettings.create({});
  return settings;
}

// Creates the ReferralTransaction record and credits the recipient's
// referralEarnings, in that order. The unique (bookingId, rewardType) index
// on ReferralTransaction is the actual idempotency guard: if this booking
// was already rewarded (by this call or a concurrent duplicate), .create()
// throws E11000 and the $inc below is never reached, so calling this
// twice for the same booking can never double-credit.
async function creditReward({ booking, referrerUserId, referredUserId, rewardType, rewardAmount, creditTo }) {
  if (!rewardAmount || rewardAmount <= 0) return;

  try {
    await ReferralTransaction.create({
      bookingId: booking._id,
      referrerUserId,
      referredUserId,
      rewardType,
      rewardAmount,
      status: "credited",
    });
  } catch (err) {
    if (err.code === 11000) return; // already rewarded — safe no-op
    throw err;
  }

  await Customer.findByIdAndUpdate(creditTo, { $inc: { referralEarnings: rewardAmount } });
}

// Awards referral rewards for a booking that has just reached a completed
// state. Must be called only once the booking is genuinely completed
// (never on registration, creation, dealer acceptance, or payment). Safe
// to call multiple times for the same booking — see creditReward() above.
async function awardReferralRewardsIfEligible(booking) {
  if (!booking || !booking.user_id || !booking._id) return;

  const settings = await getReferralSettingsSingleton();
  if (!settings.enableReferralSystem) return;
  if (!settings.enableReferrerReward && !settings.enableNewUserReward) return;

  const referee = await Customer.findById(booking.user_id).select("referredBy");
  if (!referee || !referee.referredBy) return; // this user wasn't referred

  if (settings.firstBookingOnly) {
    const priorCompletedCount = await Booking.countDocuments({
      user_id: booking.user_id,
      _id: { $ne: booking._id },
      status: { $in: COMPLETED_BOOKING_STATUSES },
    });
    if (priorCompletedCount > 0) return; // not their first completed booking
  }

  const amountDue = typeof booking.amountDue === "number"
    ? booking.amountDue
    : (booking.customerTotal || 0) - (booking.discountAmount || 0);
  if (amountDue < settings.minimumBookingAmount) return;

  if (settings.enableReferrerReward) {
    await creditReward({
      booking,
      referrerUserId: referee.referredBy,
      referredUserId: booking.user_id,
      rewardType: "referrer",
      rewardAmount: settings.referrerRewardAmount,
      creditTo: referee.referredBy,
    });
  }

  if (settings.enableNewUserReward) {
    await creditReward({
      booking,
      referrerUserId: referee.referredBy,
      referredUserId: booking.user_id,
      rewardType: "new_user",
      rewardAmount: settings.newUserRewardAmount,
      creditTo: booking.user_id,
    });
  }
}

module.exports = { awardReferralRewardsIfEligible };
