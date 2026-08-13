const OtpRequestLimit = require("../models/otpRequestLimit");
const { normalizePhone } = require("./playStoreTestAccounts");

const OTP_SEND_LIMIT = 3;
const OTP_LOCK_WINDOW_MS = 6 * 60 * 60 * 1000;

function getNormalizedPhone(phone) {
  return normalizePhone(phone).trim();
}

async function ensureLimitDocument(phone) {
  await OtpRequestLimit.updateOne(
    { phone },
    { $setOnInsert: { phone, requestCount: 0, pendingCount: 0, lockedUntil: null, lockedAt: null } },
    { upsert: true },
  );
}

async function resetIfExpired(phone, now = new Date()) {
  await OtpRequestLimit.updateOne(
    { phone, lockedUntil: { $ne: null, $lte: now } },
    { $set: { requestCount: 0, pendingCount: 0, lockedUntil: null, lockedAt: null } },
  );
}

async function reserveOtpRequest(phone) {
  const normalizedPhone = getNormalizedPhone(phone);
  const now = new Date();

  await ensureLimitDocument(normalizedPhone);
  await resetIfExpired(normalizedPhone, now);

  const reservation = await OtpRequestLimit.findOneAndUpdate(
    {
      phone: normalizedPhone,
      $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
      $expr: { $lt: [{ $add: ["$requestCount", "$pendingCount"] }, OTP_SEND_LIMIT] },
    },
    { $inc: { pendingCount: 1 }, $set: { phone: normalizedPhone } },
    { new: true },
  );

  if (!reservation) {
    const current = await OtpRequestLimit.findOne({ phone: normalizedPhone }).lean();
    const lockedUntil = current?.lockedUntil ? new Date(current.lockedUntil) : null;
    const lockActive = lockedUntil && lockedUntil > now;
    return {
      allowed: false,
      phone: normalizedPhone,
      reason: lockActive ? "locked" : "limit_reached",
      lockedUntil,
      requestCount: current?.requestCount || 0,
      pendingCount: current?.pendingCount || 0,
    };
  }

  return {
    allowed: true,
    phone: normalizedPhone,
    requestCount: reservation.requestCount,
    pendingCount: reservation.pendingCount,
    lockedUntil: reservation.lockedUntil,
  };
}

async function finalizeSuccessfulOtpRequest(phone) {
  const normalizedPhone = getNormalizedPhone(phone);
  const now = new Date();
  const lockUntil = new Date(now.getTime() + OTP_LOCK_WINDOW_MS);

  const updated = await OtpRequestLimit.findOneAndUpdate(
    { phone: normalizedPhone, pendingCount: { $gt: 0 } },
    [
      {
        $set: {
          pendingCount: { $subtract: ["$pendingCount", 1] },
          requestCount: { $add: ["$requestCount", 1] },
        },
      },
      {
        $set: {
          lockedUntil: {
            $cond: [
              { $gte: ["$requestCount", OTP_SEND_LIMIT] },
              lockUntil,
              "$lockedUntil",
            ],
          },
          lockedAt: {
            $cond: [
              { $gte: ["$requestCount", OTP_SEND_LIMIT] },
              now,
              "$lockedAt",
            ],
          },
        },
      },
    ],
    { new: true },
  );

  return updated;
}

async function releaseOtpReservation(phone) {
  const normalizedPhone = getNormalizedPhone(phone);
  await OtpRequestLimit.updateOne(
    { phone: normalizedPhone, pendingCount: { $gt: 0 } },
    { $inc: { pendingCount: -1 } },
  );
}

module.exports = {
  OTP_SEND_LIMIT,
  OTP_LOCK_WINDOW_MS,
  reserveOtpRequest,
  finalizeSuccessfulOtpRequest,
  releaseOtpReservation,
  getNormalizedPhone,
};
