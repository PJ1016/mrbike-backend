// Generates a promo code in the same "MRBD<6char>" shape the admin
// frontend generates client-side (PromoCodeFormDrawer.jsx), for the rare
// case a caller wants the backend to mint one instead (e.g. via the
// GET /preferences/promo-codes/generate-code convenience endpoint).
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generatePromoCode(prefix = "MRBD", length = 6) {
  let suffix = "";
  for (let i = 0; i < length; i++) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `${prefix}${suffix}`;
}

module.exports = { generatePromoCode };
