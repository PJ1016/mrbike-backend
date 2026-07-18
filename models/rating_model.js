const mongoose = require("mongoose");
const AutoIncrement = require('mongoose-sequence')(mongoose);

const ratingSchema = new mongoose.Schema ({
    id:{
      type:Number,
    },
    dealer_id: {
      type: String,
      ref: "Vendor",
    },
    user_id: {
      type: String,
      ref:"customers"
    },
    traking_id: {
      type: String,
    },
    rating: {
      type: Number,
      default: 0,
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

// ratingSchema.plugin(AutoIncrement);

ratingSchema.plugin(AutoIncrement, {id:'rating_seq',inc_field: 'id'});

module.exports = mongoose.model("rating", ratingSchema);