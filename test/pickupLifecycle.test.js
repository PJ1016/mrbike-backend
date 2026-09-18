const assert = require("assert");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Vendor = require("../models/dealerModel");
const Admin = require("../models/admin_model");
const CustomerModel = require("../models/customer_model");
const { requireBookingParticipant, requireActorRole } = require("../middlewares/bookingAuth");
const {
  PICKUP_STATUSES,
  ARRIVAL_RADIUS_METERS,
  isPickupBooking,
  distanceToPickupMeters,
  canMarkArrived,
  canStartPickup,
  canMarkCustomerArrived,
  shouldRecordNearby,
  pickupOtpMatches,
  canVerifyPickupOtp,
  canCompleteBikePickup,
} = require("../services/pickupLifecycle");

const CUSTOMER = new mongoose.Types.ObjectId();
const DEALER = new mongoose.Types.ObjectId();
const WRONG_DEALER = new mongoose.Types.ObjectId();
const BOOKING = new mongoose.Types.ObjectId();

async function authorizationResult(actorId, userType = 3) {
  const oldSecret = process.env.JWT_SECRET;
  const oldVendorFind = Vendor.findById;
  const oldAdminFind = Admin.findById;
  const oldBookingFind = Booking.findById;
  const oldCustomerExists = CustomerModel.exists;
  process.env.JWT_SECRET = "pickup-lifecycle-test-secret";

  Vendor.findById = () => ({
    select: () => ({ lean: async () => ({ _id: actorId, isBlocked: false }) }),
  });
  Admin.findById = () => ({ select: () => ({ lean: async () => null }) });
  Booking.findById = () => ({
    select: () => ({ lean: async () => ({ user_id: CUSTOMER, dealer_id: DEALER }) }),
  });
  CustomerModel.exists = async () => true;

  const req = {
    headers: { authorization: `Bearer ${jwt.sign({ user_id: String(actorId), user_type: userType }, process.env.JWT_SECRET)}` },
    params: { bookingId: String(BOOKING) },
  };
  let result = null;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { result = { statusCode: this.statusCode, payload }; return this; },
  };

  await requireBookingParticipant(r => r.params.bookingId)(req, res, () => {
    requireActorRole("dealer")(req, res, () => { result = { next: true }; });
  });

  Vendor.findById = oldVendorFind;
  Admin.findById = oldAdminFind;
  Booking.findById = oldBookingFind;
  CustomerModel.exists = oldCustomerExists;
  if (oldSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = oldSecret;
  return result;
}

async function run() {
  const confirmedPickup = {
    transportOption: "PICKUP_ONLY",
    status: "confirmed",
    pickupStatus: PICKUP_STATUSES.BOOKING_CONFIRMED,
  };
  assert.strictEqual(isPickupBooking(confirmedPickup), true);
  assert.strictEqual(canStartPickup(confirmedPickup), true, "confirmed pickup can start");

  const normalBooking = {
    transportOption: "SELF_VISIT",
    status: "confirmed",
    pickupStatus: "pending",
  };
  assert.strictEqual(isPickupBooking(normalBooking), false, "non-pickup booking is rejected");
  assert.strictEqual(canStartPickup(normalBooking), false);
  assert.strictEqual(canMarkCustomerArrived(normalBooking), true, "confirmed self-visit can arrive");
  assert.strictEqual(
    canMarkCustomerArrived({ ...normalBooking, pickupStatus: "arrived" }),
    false,
    "self-visit arrival cannot be repeated as a new transition",
  );
  assert.strictEqual(canMarkCustomerArrived(confirmedPickup), false, "pickup booking must use GPS arrival");
  assert.strictEqual(isPickupBooking({ transportOption: "DROP_ONLY", pickupAndDropId: BOOKING }), false);

  assert.deepStrictEqual(await authorizationResult(DEALER), { next: true });
  assert.strictEqual((await authorizationResult(WRONG_DEALER)).statusCode, 404, "wrong dealer cannot modify booking");
  assert.strictEqual((await authorizationResult(CUSTOMER, 4)).statusCode, 403, "customer cannot trigger pickup actions");

  const customerLocation = { latitude: 12.9716, longitude: 77.5946 };
  const over100m = distanceToPickupMeters({ latitude: 12.9730, longitude: 77.5946 }, customerLocation);
  const within100m = distanceToPickupMeters({ latitude: 12.9720, longitude: 77.5946 }, customerLocation);
  assert(over100m > ARRIVAL_RADIUS_METERS, "arrival is blocked above 100m");
  assert(within100m <= ARRIVAL_RADIUS_METERS, "arrival is allowed within 100m");
  assert.strictEqual(canMarkArrived(PICKUP_STATUSES.PICKUP_STARTED), true);
  assert.strictEqual(canMarkArrived(PICKUP_STATUSES.RIDER_NEARBY), true);
  assert.strictEqual(canMarkArrived(PICKUP_STATUSES.ARRIVED), false, "duplicate arrival is rejected");

  const started = { pickupStatus: PICKUP_STATUSES.PICKUP_STARTED, pickupNearbyNotifiedAt: null };
  assert.strictEqual(shouldRecordNearby(started, within100m), true);
  assert.strictEqual(
    shouldRecordNearby({ ...started, pickupNearbyNotifiedAt: new Date() }, within100m),
    false,
    "nearby notification is emitted only once"
  );

  assert.strictEqual(pickupOtpMatches(4321, "9999"), false, "invalid OTP is rejected");
  assert.strictEqual(pickupOtpMatches(4321, "4321"), true, "valid OTP is accepted");
  assert.strictEqual(pickupOtpMatches(null, "4321"), false, "consumed OTP cannot be reused");
  assert.strictEqual(
    canVerifyPickupOtp({ pickupStatus: PICKUP_STATUSES.ARRIVED, pickupOtp: 4321, pickupOtpVerifiedAt: null }, "4321"),
    true
  );
  assert.strictEqual(
    canCompleteBikePickup({ pickupStatus: PICKUP_STATUSES.PICKUP_OTP_VERIFIED, pickupOtpVerifiedAt: new Date() }),
    true,
    "valid OTP enables bike pickup completion"
  );
  assert.strictEqual(
    canCompleteBikePickup({ pickupStatus: PICKUP_STATUSES.ARRIVED, pickupOtpVerifiedAt: null }),
    false
  );

  assert.strictEqual(
    canStartPickup({ ...confirmedPickup, pickupStatus: PICKUP_STATUSES.PICKUP_STARTED }),
    false,
    "duplicate start is rejected"
  );

  const normalDoc = new Booking({
    user_id: CUSTOMER,
    dealer_id: DEALER,
    userBike_id: new mongoose.Types.ObjectId(),
    transportOption: "SELF_VISIT",
    pickupStatus: "pending",
  });
  assert.strictEqual(normalDoc.validateSync(), undefined, "normal non-pickup booking schema remains valid");
  assert.strictEqual(normalDoc.pickupTrackingActive, false);
  assert.strictEqual(normalDoc.pickupOtp, null);

  console.log("Pickup lifecycle tests passed");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
