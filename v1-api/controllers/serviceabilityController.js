const { resolveServiceableArea } = require("../helpers/resolveServiceableArea");

// GET /api/v1/serviceability?lat=&lng=
async function checkServiceability(req, res) {
  const { lat, lng } = req.query;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({
      status: 400,
      message: "lat and lng are required",
    });
  }

  const result = await resolveServiceableArea({ lat, lng });

  return res.status(200).json({
    status: 200,
    message: "Success",
    data: result,
  });
}

module.exports = { checkServiceability };
