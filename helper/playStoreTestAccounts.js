// Google Play Review Test Account
// Do not remove without replacing the Play Store testing process.
//
// Google Play reviewers log in with fixed number+OTP pairs instead of a real
// Twilio-delivered code (reviewer devices/numbers can't receive live SMS).
// Exactly these two pairs bypass Twilio; every other number is untouched and
// still goes through the normal Twilio Verify send/check flow.

const CUSTOMER_TEST_ACCOUNT = Object.freeze({
  phone: "+919999999999",
  otp: "9999",
});

const DEALER_TEST_ACCOUNT = Object.freeze({
  phone: "+918888888888",
  otp: "8888",
});

function normalizePhone(phone) {
  if (!phone) return "";
  const trimmed = String(phone).trim();
  return trimmed.startsWith("+") ? trimmed : `+91${trimmed}`;
}

function isCustomerTestPhone(phone) {
  return normalizePhone(phone) === CUSTOMER_TEST_ACCOUNT.phone;
}

function isDealerTestPhone(phone) {
  return normalizePhone(phone) === DEALER_TEST_ACCOUNT.phone;
}

function isCustomerTestOtpValid(phone, otp) {
  return isCustomerTestPhone(phone) && String(otp).trim() === CUSTOMER_TEST_ACCOUNT.otp;
}

function isDealerTestOtpValid(phone, otp) {
  return isDealerTestPhone(phone) && String(otp).trim() === DEALER_TEST_ACCOUNT.otp;
}

module.exports = {
  CUSTOMER_TEST_ACCOUNT,
  DEALER_TEST_ACCOUNT,
  normalizePhone,
  isCustomerTestPhone,
  isDealerTestPhone,
  isCustomerTestOtpValid,
  isDealerTestOtpValid,
};
