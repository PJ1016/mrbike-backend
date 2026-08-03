const assert = require("assert");
const validateRequest = require("../middlewares/requestValidation");
const { selectLimiter, limiters } = require("../middlewares/rateLimits");

function validate({ url = "/test", method = "GET", body = {}, query = {}, params = {} }) {
  let result = { next: false };
  const req = { originalUrl: url, method, body, query, params };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { result = { statusCode: this.statusCode, payload }; return this; },
  };
  validateRequest(req, res, () => { result = { next: true }; });
  return result;
}

assert.strictEqual(validate({ url: "/bikedoctor/userAuth/userLogin", method: "POST", body: { phone: "9876543210" } }).next, true);
assert.strictEqual(validate({ query: { page: "1", limit: "100" } }).next, true);
assert.strictEqual(validate({ query: { limit: "101" } }).statusCode, 400);
assert.strictEqual(validate({ params: { bookingId: "not-an-object-id" } }).statusCode, 400);
assert.strictEqual(validate({ body: { email: "invalid" } }).statusCode, 400);
assert.strictEqual(validate({ body: { otp: 1234, amount: "12.50", startDate: "2026-08-03" } }).next, true);
assert.strictEqual(validate({ url: "/bikedoctor/userAuth/otpVerify", method: "POST", body: { phone: "9876543210" } }).statusCode, 400);

assert.strictEqual(selectLimiter({ path: "/bikedoctor/userAuth/otpVerify" }), limiters.otpVerify);
assert.strictEqual(selectLimiter({ path: "/bikedoctor/payment/initiate" }), limiters.payment);
assert.strictEqual(selectLimiter({ path: "/bikedoctor/customers/getReferralSummary" }), limiters.referral);
assert.strictEqual(selectLimiter({ path: "/bikedoctor/ticket/create/abc" }), limiters.support);

console.log("Security middleware tests passed");
