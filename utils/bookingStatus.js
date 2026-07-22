// Single source of truth for booking lifecycle finality.
//
// A booking is ACTIVE until it reaches one of the FINAL_BOOKING_STATUSES.
// Every place in the backend that needs to decide "is this booking still
// in progress?" (single-active-booking-per-bike guard, dashboards, etc.)
// must go through isBookingActive() / isBookingFinal() rather than
// re-listing status strings.
const FINAL_BOOKING_STATUSES = [
  "completed",
  "delivered",
  "cancelled",
  "user_cancelled",
  "rejected",
  "expired",
];

function isBookingFinal(status) {
  return FINAL_BOOKING_STATUSES.includes(status);
}

function isBookingActive(status) {
  if (!status) return false;
  return !isBookingFinal(status);
}

// Mongo query fragment selecting only active bookings for a given filter,
// e.g. Booking.findOne({ userBike_id, ...ACTIVE_BOOKING_QUERY }).
const ACTIVE_BOOKING_QUERY = { status: { $nin: FINAL_BOOKING_STATUSES } };

module.exports = {
  FINAL_BOOKING_STATUSES,
  isBookingActive,
  isBookingFinal,
  ACTIVE_BOOKING_QUERY,
};
