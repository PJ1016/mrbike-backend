const mongoose = require("mongoose");

const pickndropSchema = new mongoose.Schema({
    dealer_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Vendor"
    },
    user_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"customers"
    },
    // service_provider_address:{
    //     type:String,
    // },
    user_lat: { // Replacing user_address
        type: Number,
    },
    user_lng: { // Replacing user_address
        type: Number,
    },
    otp:{
        type:Number,
    },
    status: {
        type: Number,
        default: 1, // 0 = inactive , 1 = active
    },
},
{
    timestamps:true,
})

module.exports = mongoose.model("PicknDrop", pickndropSchema);
