const mongoose = require("mongoose");
const AutoIncrement = require('mongoose-sequence')(mongoose);


const trackingSchema = new mongoose.Schema({
    id:{
        type:Number,
      },
    status:{
        type:String,
        enum : ["Order Placed","Order Confirmed","Order Completed","Payment","rejected","cash recieved","expired"],
        default:'Order Placed',
    },
    service_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"service"
    },
    services:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"service"
    }],
    dealer_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"dealer"
    },
    dealrs_id:{
        type:String,
    },
    users_id:{
        type:String,
    },
    booking_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Booking"
    },
    user_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"customers"
    },
},
{
    timestamps:true,
}
);
trackingSchema.plugin(AutoIncrement, { id: "tracking_seq", inc_field: "id" });


module.exports = mongoose.model("Tracking", trackingSchema);
