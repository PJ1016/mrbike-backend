const mongoose = require("mongoose");
const ServiceableArea = require("../../models/ServiceableArea");

const STATUSES = ["live", "coming_soon", "paused"];
const TYPES = ["city", "radius"];

function validateAreaPayload(body, { partial } = { partial: false }) {
  const { name, type, cityName, latitude, longitude, radiusKm, status, pausedReason } = body;

  if (!partial || name !== undefined) {
    if (!name || !String(name).trim()) {
      return "name is required";
    }
  }

  if (type !== undefined && !TYPES.includes(type)) {
    return "type must be city or radius";
  }

  const resolvedType = type || (partial ? undefined : "city");
  if (resolvedType === "city" && (!partial || cityName !== undefined)) {
    if (!cityName || !String(cityName).trim()) {
      return "cityName is required when type is city";
    }
  }
  if (resolvedType === "radius" && !partial) {
    if (latitude === undefined || latitude === null || latitude === "") {
      return "latitude is required when type is radius";
    }
    if (longitude === undefined || longitude === null || longitude === "") {
      return "longitude is required when type is radius";
    }
    if (!radiusKm || Number(radiusKm) <= 0) {
      return "radiusKm must be greater than 0 when type is radius";
    }
  }

  if (status !== undefined && !STATUSES.includes(status)) {
    return "status must be live, coming_soon or paused";
  }
  if (status === "paused" && (!pausedReason || !String(pausedReason).trim())) {
    return "pausedReason is required when status is paused";
  }

  return null;
}

function buildAreaFields(body) {
  const { name, type, cityName, latitude, longitude, radiusKm, status, pausedReason, estimatedLiveDate } = body;

  const fields = {};
  if (name !== undefined) fields.name = String(name).trim();
  if (type !== undefined) fields.type = type;

  if (type === "city") {
    fields.cityName = cityName ? String(cityName).trim() : null;
    fields.location = undefined;
    fields.radiusKm = null;
  } else if (type === "radius") {
    fields.cityName = null;
    if (latitude !== undefined && longitude !== undefined) {
      fields.location = { type: "Point", coordinates: [Number(longitude), Number(latitude)] };
    }
    if (radiusKm !== undefined) fields.radiusKm = Number(radiusKm);
  }

  if (status !== undefined) {
    fields.status = status;
    fields.pausedReason = status === "paused" ? String(pausedReason).trim() : null;
    if (status !== "coming_soon" && estimatedLiveDate === undefined) {
      fields.estimatedLiveDate = null;
    }
  }
  if (estimatedLiveDate !== undefined) {
    fields.estimatedLiveDate = estimatedLiveDate ? new Date(estimatedLiveDate) : null;
  }

  return fields;
}

// GET /api/v1/admin/serviceable-areas?search=&status=&page=&limit=
async function getList(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { cityName: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const [total, data] = await Promise.all([
      ServiceableArea.countDocuments(filter),
      ServiceableArea.find(filter)
        .sort({ createdAt: -1 })
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
    console.error("ServiceableArea getList error:", error);
    return res.status(500).json({ status: 500, message: "Operation was not successful" });
  }
}

// GET /api/v1/admin/serviceable-areas/:id
async function getSingle(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Invalid ID" });
    }

    const data = await ServiceableArea.findById(id).lean();
    if (!data) {
      return res.status(404).json({ status: 404, message: "Record not found" });
    }

    return res.status(200).json({ status: 200, message: "Success", data });
  } catch (error) {
    console.error("ServiceableArea getSingle error:", error);
    return res.status(500).json({ status: 500, message: "Operation was not successful" });
  }
}

// POST /api/v1/admin/serviceable-areas
async function create(req, res) {
  try {
    const validationError = validateAreaPayload(req.body, { partial: false });
    if (validationError) {
      return res.status(400).json({ status: 400, message: validationError });
    }

    const fields = buildAreaFields({ type: "city", ...req.body });
    fields.createdBy = req.admin_id;
    fields.updatedBy = req.admin_id;

    const doc = await ServiceableArea.create(fields);

    return res.status(200).json({ status: 200, message: "Created successfully", data: doc });
  } catch (error) {
    console.error("ServiceableArea create error:", error);
    return res.status(500).json({ status: 500, message: "Operation was not successful" });
  }
}

// PUT /api/v1/admin/serviceable-areas/:id
async function update(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Invalid ID" });
    }

    const existing = await ServiceableArea.findById(id);
    if (!existing) {
      return res.status(404).json({ status: 404, message: "Record not found" });
    }

    const validationError = validateAreaPayload(req.body, { partial: true });
    if (validationError) {
      return res.status(400).json({ status: 400, message: validationError });
    }

    const fields = buildAreaFields(req.body);
    fields.updatedBy = req.admin_id;

    const updated = await ServiceableArea.findByIdAndUpdate(
      id,
      { $set: fields, ...(fields.location === undefined ? { $unset: { location: 1 } } : {}) },
      { new: true, runValidators: true }
    );

    return res.status(200).json({ status: 200, message: "Updated successfully", data: updated });
  } catch (error) {
    console.error("ServiceableArea update error:", error);
    return res.status(500).json({ status: 500, message: "Operation was not successful" });
  }
}

// DELETE /api/v1/admin/serviceable-areas/:id
async function remove(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Invalid ID" });
    }

    const existing = await ServiceableArea.findById(id);
    if (!existing) {
      return res.status(404).json({ status: 404, message: "Record not found" });
    }

    await ServiceableArea.findByIdAndDelete(id);

    return res.status(200).json({ status: 200, message: "Deleted successfully" });
  } catch (error) {
    console.error("ServiceableArea remove error:", error);
    return res.status(500).json({ status: 500, message: "Operation was not successful" });
  }
}

// PATCH /api/v1/admin/serviceable-areas/:id/status
// The fast-path used to pause/unpause/toggle-live an area without opening the full edit form.
async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Invalid ID" });
    }

    const { status, pausedReason, estimatedLiveDate } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ status: 400, message: "status must be live, coming_soon or paused" });
    }
    if (status === "paused" && (!pausedReason || !String(pausedReason).trim())) {
      return res.status(400).json({
        status: 400,
        message: "pausedReason is required when pausing an area",
      });
    }

    const existing = await ServiceableArea.findById(id);
    if (!existing) {
      return res.status(404).json({ status: 404, message: "Record not found" });
    }

    const fields = {
      status,
      pausedReason: status === "paused" ? String(pausedReason).trim() : null,
      updatedBy: req.admin_id,
    };
    if (status === "coming_soon" && estimatedLiveDate) {
      fields.estimatedLiveDate = new Date(estimatedLiveDate);
    } else if (status !== "coming_soon") {
      fields.estimatedLiveDate = null;
    }

    const updated = await ServiceableArea.findByIdAndUpdate(id, { $set: fields }, { new: true });

    return res.status(200).json({
      status: 200,
      message: `Status updated to ${status}`,
      data: updated,
    });
  } catch (error) {
    console.error("ServiceableArea updateStatus error:", error);
    return res.status(500).json({ status: 500, message: "Operation was not successful" });
  }
}

module.exports = { getList, getSingle, create, update, remove, updateStatus };
