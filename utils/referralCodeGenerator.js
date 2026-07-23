// Generates a unique referral code for customers, following the same
// charset/shape convention as promoCodeGenerator.js. Unlike promo codes
// (which are admin-entered and checked once on save), referral codes are
// minted server-side per user, so uniqueness is verified against the DB
// in a retry loop here.
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateReferralCode(prefix = "REF", length = 6) {
  let suffix = "";
  for (let i = 0; i < length; i++) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `${prefix}${suffix}`;
}

async function generateUniqueReferralCode(CustomerModel) {
  let code;
  let exists = true;
  while (exists) {
    code = generateReferralCode();
    exists = await CustomerModel.exists({ referralCode: code });
  }
  return code;
}

module.exports = { generateReferralCode, generateUniqueReferralCode };
