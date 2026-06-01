const mongoose = require("mongoose");
const LocationFeaturedCategory = require("../models/LocationFeaturedCategory");

async function getList(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      filter.$or = [
        { categoryName: { $regex: req.query.search, $options: "i" } },
        { locationName: { $regex: req.query.search, $options: "i" } },
        { address: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const [total, data] = await Promise.all([
      LocationFeaturedCategory.countDocuments(filter),
      LocationFeaturedCategory.find(filter)
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      status: 200,
      message: "Success",
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("getList error:", error);
    return res
      .status(500)
      .json({ status: 500, message: "Operation was not successful" });
  }
}

async function getSingle(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Invalid ID" });
    }

    const data = await LocationFeaturedCategory.findById(id).lean();

    if (!data) {
      return res
        .status(404)
        .json({ status: 404, message: "Record not found" });
    }

    return res.status(200).json({ status: 200, message: "Success", data });
  } catch (error) {
    console.error("getSingle error:", error);
    return res
      .status(500)
      .json({ status: 500, message: "Operation was not successful" });
  }
}

async function create(req, res) {
  try {
    const {
      categoryName,
      locationName,
      address,
      latitude,
      longitude,
      radius,
      displayOrder,
      status,
    } = req.body;

    if (!categoryName || !categoryName.trim()) {
      return res
        .status(400)
        .json({ status: 400, message: "categoryName is required" });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ status: 400, message: "categoryImage is required" });
    }
    if (!locationName || !locationName.trim()) {
      return res
        .status(400)
        .json({ status: 400, message: "locationName is required" });
    }
    if (latitude === undefined || latitude === null || latitude === "") {
      return res
        .status(400)
        .json({ status: 400, message: "latitude is required" });
    }
    if (longitude === undefined || longitude === null || longitude === "") {
      return res
        .status(400)
        .json({ status: 400, message: "longitude is required" });
    }
    if (!radius || Number(radius) <= 0) {
      return res
        .status(400)
        .json({ status: 400, message: "radius must be greater than 0" });
    }
    if (displayOrder !== undefined && isNaN(Number(displayOrder))) {
      return res
        .status(400)
        .json({ status: 400, message: "displayOrder must be numeric" });
    }
    if (status && !["active", "inactive"].includes(status)) {
      return res
        .status(400)
        .json({ status: 400, message: "status must be active or inactive" });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    const doc = await LocationFeaturedCategory.create({
      categoryName: categoryName.trim(),
      categoryImage: req.file.location,
      locationName: locationName.trim(),
      address: address ? address.trim() : "",
      latitude: lat,
      longitude: lng,
      location: { type: "Point", coordinates: [lng, lat] },
      radius: Number(radius),
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : 0,
      status: status || "active",
      createdBy: req.user_id,
      updatedBy: req.user_id,
    });

    return res
      .status(200)
      .json({ status: 200, message: "Created successfully", data: doc });
  } catch (error) {
    console.error("create error:", error);
    return res
      .status(500)
      .json({ status: 500, message: "Operation was not successful" });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Invalid ID" });
    }

    const existing = await LocationFeaturedCategory.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ status: 404, message: "Record not found" });
    }

    const {
      categoryName,
      locationName,
      address,
      latitude,
      longitude,
      radius,
      displayOrder,
      status,
    } = req.body;

    if (status && !["active", "inactive"].includes(status)) {
      return res
        .status(400)
        .json({ status: 400, message: "status must be active or inactive" });
    }
    if (radius !== undefined && Number(radius) <= 0) {
      return res
        .status(400)
        .json({ status: 400, message: "radius must be greater than 0" });
    }
    if (displayOrder !== undefined && isNaN(Number(displayOrder))) {
      return res
        .status(400)
        .json({ status: 400, message: "displayOrder must be numeric" });
    }

    const updateData = { updatedBy: req.user_id };

    if (categoryName) updateData.categoryName = categoryName.trim();
    if (locationName) updateData.locationName = locationName.trim();
    if (address !== undefined) updateData.address = address.trim();
    if (radius !== undefined) updateData.radius = Number(radius);
    if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);
    if (status) updateData.status = status;
    if (req.file) updateData.categoryImage = req.file.location;

    if (latitude !== undefined || longitude !== undefined) {
      const lat = Number(latitude !== undefined ? latitude : existing.latitude);
      const lng = Number(longitude !== undefined ? longitude : existing.longitude);
      updateData.latitude = lat;
      updateData.longitude = lng;
      updateData.location = { type: "Point", coordinates: [lng, lat] };
    }

    const updated = await LocationFeaturedCategory.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    return res
      .status(200)
      .json({ status: 200, message: "Updated successfully", data: updated });
  } catch (error) {
    console.error("update error:", error);
    return res
      .status(500)
      .json({ status: 500, message: "Operation was not successful" });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Invalid ID" });
    }

    const existing = await LocationFeaturedCategory.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ status: 404, message: "Record not found" });
    }

    await LocationFeaturedCategory.findByIdAndDelete(id);

    return res
      .status(200)
      .json({ status: 200, message: "Deleted successfully" });
  } catch (error) {
    console.error("remove error:", error);
    return res
      .status(500)
      .json({ status: 500, message: "Operation was not successful" });
  }
}

async function toggleStatus(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Invalid ID" });
    }

    const existing = await LocationFeaturedCategory.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ status: 404, message: "Record not found" });
    }

    const newStatus = existing.status === "active" ? "inactive" : "active";

    const updated = await LocationFeaturedCategory.findByIdAndUpdate(
      id,
      { $set: { status: newStatus, updatedBy: req.user_id } },
      { new: true }
    );

    return res.status(200).json({
      status: 200,
      message: `Status updated to ${newStatus}`,
      data: updated,
    });
  } catch (error) {
    console.error("toggleStatus error:", error);
    return res
      .status(500)
      .json({ status: 500, message: "Operation was not successful" });
  }
}

const DUMMY_LOCATIONS = [
  {
    name: "Connaught Place",
    address: "Connaught Place, New Delhi, Delhi 110001",
    lat: 28.6315,
    lng: 77.2167,
  },
  {
    name: "Koregaon Park",
    address: "Koregaon Park, Pune, Maharashtra 411001",
    lat: 18.5362,
    lng: 73.8937,
  },
  {
    name: "Indiranagar",
    address: "Indiranagar, Bengaluru, Karnataka 560038",
    lat: 12.9784,
    lng: 77.6408,
  },
  {
    name: "Bandra West",
    address: "Bandra West, Mumbai, Maharashtra 400050",
    lat: 19.0596,
    lng: 72.8295,
  },
  {
    name: "Salt Lake City",
    address: "Salt Lake City, Kolkata, West Bengal 700064",
    lat: 22.5726,
    lng: 88.4182,
  },
  {
    name: "T. Nagar",
    address: "T. Nagar, Chennai, Tamil Nadu 600017",
    lat: 13.0418,
    lng: 80.2341,
  },
  {
    name: "Hitech City",
    address: "Hitech City, Hyderabad, Telangana 500081",
    lat: 17.4474,
    lng: 78.3762,
  },
  {
    name: "Civil Lines",
    address: "Civil Lines, Jaipur, Rajasthan 302006",
    lat: 26.9124,
    lng: 75.7873,
  },
  {
    name: "Navrangpura",
    address: "Navrangpura, Ahmedabad, Gujarat 380009",
    lat: 23.0411,
    lng: 72.5534,
  },
  {
    name: "Arera Colony",
    address: "Arera Colony, Bhopal, Madhya Pradesh 462016",
    lat: 23.2003,
    lng: 77.4302,
  },
  {
    name: "Hazratganj",
    address: "Hazratganj, Lucknow, Uttar Pradesh 226001",
    lat: 26.8467,
    lng: 80.9462,
  },
  {
    name: "Shyambazar",
    address: "Shyambazar, Kolkata, West Bengal 700004",
    lat: 22.5958,
    lng: 88.3697,
  },
];

async function locationSearch(req, res) {
  try {
    const { q } = req.query;
    let results = DUMMY_LOCATIONS;

    if (q && q.trim()) {
      const query = q.trim().toLowerCase();
      results = DUMMY_LOCATIONS.filter(
        (loc) =>
          loc.name.toLowerCase().includes(query) ||
          loc.address.toLowerCase().includes(query)
      );
    }

    return res
      .status(200)
      .json({ status: 200, message: "Success", data: results });
  } catch (error) {
    console.error("locationSearch error:", error);
    return res
      .status(500)
      .json({ status: 500, message: "Operation was not successful" });
  }
}

// radius field is stored in km; distance from $geoNear is in meters
async function getUserFeaturedCategories(req, res) {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        status: 400,
        message: "latitude and longitude are required",
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res
        .status(400)
        .json({ status: 400, message: "Invalid latitude or longitude" });
    }

    const categories = await LocationFeaturedCategory.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distance",
          spherical: true,
          query: { status: "active" },
          maxDistance: 500 * 1000, // 500 km outer cap
        },
      },
      {
        // keep only records where user is within the configured radius (km → m)
        $match: {
          $expr: { $lte: ["$distance", { $multiply: ["$radius", 1000] }] },
        },
      },
      { $sort: { displayOrder: 1 } },
    ]);

    return res.status(200).json({
      status: 200,
      message: "Success",
      data: categories,
    });
  } catch (error) {
    console.error("getUserFeaturedCategories error:", error);
    return res
      .status(500)
      .json({ status: 500, message: "Operation was not successful" });
  }
}

module.exports = {
  getList,
  getSingle,
  create,
  update,
  remove,
  toggleStatus,
  locationSearch,
  getUserFeaturedCategories,
};
