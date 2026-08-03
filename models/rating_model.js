const mongoose = require("mongoose");
const AutoIncrement = require('mongoose-sequence')(mongoose);

const ratingSchema = new mongoose.Schema ({
    id:{
      type:Number,
    },
    dealer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref:"customers",
      required: true,
      index: true,
    },
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", index: true, sparse: true },
    traking_id: {
      type: String,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: "",
    },
    review: {
      type: String,
      default: "",
    },
    reason: {
      type: String,
      default: "",
    },
    categoryRatings: {
      mechanicBehaviour: { type: Number, min: 1, max: 5 },
      serviceQuality: { type: Number, min: 1, max: 5 },
      pickupExperience: { type: Number, min: 1, max: 5 },
      deliveryExperience: { type: Number, min: 1, max: 5 },
      timeManagement: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      overallSatisfaction: { type: Number, min: 1, max: 5 },
    },
    recommend: { type: Boolean, default: null },
    isAnonymous: { type: Boolean, default: false },
    moderationStatus: { type: String, enum: ["published", "hidden", "spam"], default: "published", index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    editExpiresAt: { type: Date, default: null },
    lastEditedAt: { type: Date, default: null },
    isArchived: {
      type: Boolean,
      default: false,
    },
    is_skipe: {
      type: String,
      default: "0"
    },
},
{
  timestamps:true,
}
);

// Legacy reviews did not have booking_id; sparse keeps them readable while
// atomically enforcing one review per booking for all new reviews.
ratingSchema.index({ booking_id: 1 }, { unique: true, sparse: true });
ratingSchema.index({ dealer_id: 1, moderationStatus: 1, createdAt: -1 });

// ratingSchema.plugin(AutoIncrement);

ratingSchema.plugin(AutoIncrement, {id:'rating_seq',inc_field: 'id'});

module.exports = mongoose.model("rating", ratingSchema);
