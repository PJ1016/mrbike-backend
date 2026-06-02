const mongoose = require("mongoose");

const locationFeaturedCategorySchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: true,
      trim: true,
    },
    categoryImage: {
      type: String,
      default: "",
    },
    locationName: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    radius: {
      type: Number,
      required: true,
      min: [1, "radius must be greater than 0"],
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaseService",
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

locationFeaturedCategorySchema.index({ location: "2dsphere" });

module.exports = mongoose.model(
  "location_featured_category",
  locationFeaturedCategorySchema
);
