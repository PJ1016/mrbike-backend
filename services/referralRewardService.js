const Customer = require("../models/customer_model");
const Booking = require("../models/Booking");
const ReferralSettings = require("../models/ReferralSettings");
const ReferralTransaction = require("../models/ReferralTransaction");
const MrBikeMoneyTransaction = require("../models/MrBikeMoneyTransaction");

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

  let referralTransaction;
  try {
    referralTransaction = await ReferralTransaction.create({
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

  const updated = await Customer.findByIdAndUpdate(
    creditTo,
    { $inc: { referralEarnings: rewardAmount, mrBikeMoneyBalance: rewardAmount } },
    { new: true }
  );

  // ReferralTransaction remains the referral-specific audit record; this
  // wallet ledger also makes the same credit visible beside redemptions and
  // refunds. Its key mirrors the referral transaction's unique booking/type.
  if (updated) {
    try {
      await MrBikeMoneyTransaction.create({
        userId: creditTo,
        bookingId: booking._id,
        referralTransactionId: referralTransaction._id,
        type: "credit",
        amount: rewardAmount,
        balanceAfter: updated.mrBikeMoneyBalance,
        description: rewardType === "referrer" ? "Referral reward" : "New user referral reward",
        idempotencyKey: `referral:${booking._id}:${rewardType}`,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
}

async function creditSignupWallet({ creditTo, referredUserId, rewardType, rewardAmount }) {
  if (!rewardAmount || rewardAmount <= 0) return;
  const updated = await Customer.findByIdAndUpdate(
    creditTo,
    { $inc: { referralEarnings: rewardAmount, mrBikeMoneyBalance: rewardAmount } },
    { new: true }
  );
  if (!updated) return;

  try {
    await MrBikeMoneyTransaction.create({
      userId: creditTo,
      type: "credit",
      amount: rewardAmount,
      balanceAfter: updated.mrBikeMoneyBalance,
      description: rewardType === "referrer" ? "Referral signup reward" : "New user signup reward",
      idempotencyKey: `referral-signup:${referredUserId}:${rewardType}`,
    });
  } catch (error) {
    if (error.code !== 11000) {
      console.error("MR Bike Money signup ledger error:", error.message);
    }
  }
}

// Credits the configured amounts immediately after a referral code is
// accepted. The marker is claimed atomically so repeated profile submissions
// or concurrent requests cannot credit the same referral twice.
async function awardReferralSignupRewardsIfEligible(referredUserId) {
  const settings = await getReferralSettingsSingleton();
  if (!settings.enableReferralSystem || settings.rewardOnReferralSignup === false) return;
  if (!settings.enableReferrerReward && !settings.enableNewUserReward) return;

  const referee = await Customer.findOneAndUpdate(
    {
      _id: referredUserId,
      referredBy: { $ne: null },
      referralSignupRewardCreditedAt: null,
    },
    { $set: { referralSignupRewardCreditedAt: new Date() } },
    { new: true }
  ).select("referredBy");
  if (!referee) return;

  if (settings.enableReferrerReward) {
    await creditSignupWallet({
      creditTo: referee.referredBy,
      referredUserId: referee._id,
      rewardType: "referrer",
      rewardAmount: settings.referrerRewardAmount,
    });
  }
  if (settings.enableNewUserReward) {
    await creditSignupWallet({
      creditTo: referee._id,
      referredUserId: referee._id,
      rewardType: "new_user",
      rewardAmount: settings.newUserRewardAmount,
    });
  }
}

// Awards referral rewards for a booking that has just reached a completed
// state. Must be called only once the booking is genuinely completed
// (never on registration, creation, dealer acceptance, or payment). Safe
// to call multiple times for the same booking — see creditReward() above.
async function awardReferralRewardsIfEligible(booking) {
  if (!booking || !booking.user_id || !booking._id) return;

  const settings = await getReferralSettingsSingleton();
  if (!settings.enableReferralSystem) return;
  if (settings.rewardOnReferralSignup !== false) return;
  if (!settings.enableReferrerReward && !settings.enableNewUserReward) return;

  const referee = await Customer.findById(booking.user_id).select("referredBy referralSignupRewardCreditedAt");
  if (!referee || !referee.referredBy) return; // this user wasn't referred
  if (referee.referralSignupRewardCreditedAt) return; // already credited at signup

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

module.exports = { awardReferralRewardsIfEligible, awardReferralSignupRewardsIfEligible };
