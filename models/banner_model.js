const mongoose = require("mongoose");
const AutoIncrement = require('mongoose-sequence')(mongoose);

const bannerSchema = new mongoose.Schema({
  id: {
    type: Number,
  },
  bannerId: {
    type: String,
    unique: true,
  },
  name: String,
  banner_image: {
    type: String,
    default: "",
  },
  from_date: {
    type: Date,
    required: true,
  },
  expiry_date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["upcoming", "active", "expired"],
    default: "upcoming", // fallback until computed
  },
  baseServiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BaseService",
    default: null,
  },
  locationType: {
    type: String,
    enum: ["all", "specific"],
    default: "all",
  },
  placeId: {
    type: String,
    default: "",
  },
  placeName: {
    type: String,
    default: "",
  },
  latitude: {
    type: Number,
  },
  longitude: {
    type: Number,
  },
  radius: {
    type: Number,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

bannerSchema.plugin(AutoIncrement, { id: "banner_seq", inc_field: "id" });

// Pre-save hook to generate readable bannerId (6 characters)
bannerSchema.pre("save", async function (next) {
  if (!this.isNew || this.bannerId) return next();

  try {
    // Generate bannerId in format: BAN + 3-digit sequence
    // Example: BAN001, BAN002, etc.
    const count = await mongoose.model("Banner").countDocuments();
    const sequence = String(count + 1).padStart(3, "0");
    this.bannerId = `BAN${sequence}`;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("Banner", bannerSchema);
