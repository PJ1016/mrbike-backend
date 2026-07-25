const mongoose = require("mongoose");

const serviceableAreaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["city", "radius"],
      default: "city",
    },
    // Required when type === "city". Matched case-insensitively against the
    // reverse-geocoded city name for a user's coordinates.
    cityName: {
      type: String,
      trim: true,
      default: null,
    },
    // Required when type === "radius". GeoJSON Point, center of the geofence.
    // No `default` on either sub-path: Mongoose auto-instantiates a nested
    // object's sub-paths that have defaults even when the parent key is
    // never set on the input doc, which previously produced a stored
    // `location: { type: "Point" }` (no coordinates) for every city-type
    // area — invalid GeoJSON that a 2dsphere index rejects on insert.
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    // Required when type === "radius". Radius in kilometers.
    radiusKm: {
      type: Number,
      min: [0.1, "radiusKm must be greater than 0"],
      default: null,
    },
    status: {
      type: String,
      enum: ["live", "coming_soon", "paused"],
      default: "coming_soon",
    },
    // Required when status === "paused" — shown to users, so it must be set.
    pausedReason: {
      type: String,
      trim: true,
      default: null,
    },
    // Optional, only relevant when status === "coming_soon".
    estimatedLiveDate: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: String,
    },
    updatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

serviceableAreaSchema.index({ location: "2dsphere" }, { sparse: true });
serviceableAreaSchema.index({ cityName: 1 });

serviceableAreaSchema.pre("validate", function (next) {
  if (this.type === "city" && !this.cityName) {
    return next(new Error("cityName is required when type is city"));
  }
  if (this.type === "radius") {
    if (
      !this.location ||
      !this.location.coordinates ||
      this.location.coordinates.length !== 2
    ) {
      return next(
        new Error("location (latitude/longitude) is required when type is radius")
      );
    }
    if (!this.radiusKm || this.radiusKm <= 0) {
      return next(new Error("radiusKm is required when type is radius"));
    }
  }
  if (this.status === "paused" && !this.pausedReason) {
    return next(new Error("pausedReason is required when status is paused"));
  }
  next();
});

module.exports = mongoose.model("ServiceableArea", serviceableAreaSchema);
