/**
 * Per-dealer service radius — single source of truth.
 *
 * Every garage decides how far from its shop it is willing to serve. A user
 * only ever sees a garage (and therefore its services) when the user's live
 * location falls inside that garage's own radius. Dealers that never set one
 * fall back to DEFAULT_SERVICE_RADIUS_KM, which is the 3 km that used to be
 * hard-coded in controller/dealer.js and v1-api/helpers/geoAndRatings.js.
 *
 * Set by: admin (POST /dealer/addDealer, PUT /dealer/editDealer) and by the
 * dealer themselves (POST /dealerAuth/location-info/:id, PUT
 * /dealerAuth/service-radius/:id).
 * Enforced by: every user-facing dealer lookup — see isWithinServiceRadius
 * callers.
 */

const DEFAULT_SERVICE_RADIUS_KM = 3;
const MIN_SERVICE_RADIUS_KM = 0.5;
const MAX_SERVICE_RADIUS_KM = 50;

// Rough km-per-degree of latitude. Used only to size the coarse bounding box
// that pre-filters dealers before the exact Haversine check runs, so an
// over-estimate is safe (it only widens the candidate set) and an
// under-estimate would silently drop far-radius dealers.
const KM_PER_DEGREE = 111;

/**
 * The radius this dealer actually serves, in km. Anything missing, malformed,
 * or out of range reads as the default rather than as "serves nowhere" — a bad
 * stored value must never make a live garage invisible.
 * @param {object} dealer Vendor document or lean object
 * @returns {number} radius in km
 */
function getDealerServiceRadiusKm(dealer) {
  const raw = Number(dealer?.serviceRadiusKm);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_SERVICE_RADIUS_KM;
  if (raw < MIN_SERVICE_RADIUS_KM) return MIN_SERVICE_RADIUS_KM;
  if (raw > MAX_SERVICE_RADIUS_KM) return MAX_SERVICE_RADIUS_KM;
  return raw;
}

/**
 * Is a user this far from the dealer still inside the dealer's service area?
 * @param {number} distanceKm distance between user and dealer
 * @param {object} dealer Vendor document or lean object
 * @returns {boolean}
 */
function isWithinServiceRadius(distanceKm, dealer) {
  if (!Number.isFinite(distanceKm)) return false;
  return distanceKm <= getDealerServiceRadiusKm(dealer);
}

/**
 * Degrees of lat/lng to widen a bounding-box pre-filter by, so that no dealer
 * whose own radius could still reach the user is excluded before the exact
 * distance check. Always sized off MAX_SERVICE_RADIUS_KM, never off the
 * default — a dealer serving 25 km lives far outside a 3 km box.
 * @returns {number} degrees
 */
function serviceRadiusBoundingBoxDegrees() {
  return MAX_SERVICE_RADIUS_KM / KM_PER_DEGREE;
}

/**
 * Validates and coerces an incoming serviceRadiusKm value.
 * An empty/undefined value is treated as "not provided" (no error, no value)
 * so partial updates never clobber a radius the caller didn't mean to touch.
 * @param {*} value raw request value
 * @returns {{ provided: boolean, value: number|null, error: string|null }}
 */
function parseServiceRadiusKm(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { provided: false, value: null, error: null };
  }
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return { provided: true, value: null, error: "Service radius must be a number" };
  }
  if (parsed < MIN_SERVICE_RADIUS_KM || parsed > MAX_SERVICE_RADIUS_KM) {
    return {
      provided: true,
      value: null,
      error: `Service radius must be between ${MIN_SERVICE_RADIUS_KM} and ${MAX_SERVICE_RADIUS_KM} km`,
    };
  }
  return { provided: true, value: parsed, error: null };
}

module.exports = {
  DEFAULT_SERVICE_RADIUS_KM,
  MIN_SERVICE_RADIUS_KM,
  MAX_SERVICE_RADIUS_KM,
  getDealerServiceRadiusKm,
  isWithinServiceRadius,
  serviceRadiusBoundingBoxDegrees,
  parseServiceRadiusKm,
};
