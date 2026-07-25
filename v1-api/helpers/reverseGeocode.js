const axios = require("axios");

// Reuses the same Google Geocoding API key already used by controller/map.js
// (process.env.MAPKEY) rather than introducing a second geocoding provider.
async function reverseGeocodeCity({ lat, lng }) {
  const apiKey = process.env.MAPKEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const response = await axios.get(url);
    const results = response.data && response.data.results;
    if (!results || !results.length) return null;

    for (const result of results) {
      const components = result.address_components || [];
      const locality = components.find((c) => c.types.includes("locality"));
      if (locality) return locality.long_name;

      const district = components.find((c) =>
        c.types.includes("administrative_area_level_2")
      );
      if (district) return district.long_name;
    }
    return null;
  } catch (error) {
    console.error("reverseGeocodeCity error:", error.message);
    return null;
  }
}

module.exports = { reverseGeocodeCity };
