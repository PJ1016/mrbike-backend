const ServiceableArea = require("../../models/ServiceableArea");
const { reverseGeocodeCity } = require("./reverseGeocode");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const UNKNOWN_AREA_RESULT = {
  status: "coming_soon",
  areaName: "your area",
  reason: null,
  estimatedLiveDate: null,
};

function serializeArea(area) {
  return {
    status: area.status,
    areaName: area.name,
    reason: area.status === "paused" ? area.pausedReason : null,
    estimatedLiveDate:
      area.status === "coming_soon" && area.estimatedLiveDate
        ? area.estimatedLiveDate
        : null,
  };
}

// Resolves a coordinate to a ServiceableArea. Radius (geofence) areas are
// checked first since they're the more specific match; falls back to
// city-name matching via reverse geocoding. Never throws — any failure
// (bad coords, geocoding failure, no match) resolves to "coming_soon" so an
// unmapped area is never silently treated as live.
async function resolveServiceableArea({ lat, lng }) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return UNKNOWN_AREA_RESULT;
  }

  try {
    const radiusMatches = await ServiceableArea.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [longitude, latitude] },
          distanceField: "distance",
          spherical: true,
          query: { type: "radius" },
          maxDistance: 500 * 1000, // 500 km outer cap, mirrors LocationFeaturedCategory
        },
      },
      {
        $match: {
          $expr: { $lte: ["$distance", { $multiply: ["$radiusKm", 1000] }] },
        },
      },
      { $sort: { distance: 1 } },
      { $limit: 1 },
    ]);

    if (radiusMatches.length) {
      return serializeArea(radiusMatches[0]);
    }
  } catch (error) {
    console.error("resolveServiceableArea radius lookup error:", error);
  }

  try {
    const cityName = await reverseGeocodeCity({ lat: latitude, lng: longitude });
    if (cityName) {
      const cityMatch = await ServiceableArea.findOne({
        type: "city",
        cityName: { $regex: `^${escapeRegex(cityName)}$`, $options: "i" },
      }).lean();
      if (cityMatch) {
        return serializeArea(cityMatch);
      }
    }
  } catch (error) {
    console.error("resolveServiceableArea city lookup error:", error);
  }

  return UNKNOWN_AREA_RESULT;
}

module.exports = { resolveServiceableArea };
