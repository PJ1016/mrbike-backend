const mongoose = require('mongoose')

const AutoIncrement = require('mongoose-sequence')(mongoose);
// const Res = ['pending','done','processing']
const Roles = ['Admin','SubAdmin','Dealer']
const reportSchema = new mongoose.Schema({
  
    user_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"customers",
        required:true
        
    },
    dealer_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Vendor",
        required:true
    },
    booking_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"Booking",
        default: null
        },
    message:{
        type:String,
        required:true
    },
    Reply:{
        type:String,
        default:"wait for reply"

    },
    ReplyType:{
       type:String,
       enum:Roles,

    },
    status:{
        type:String,
        // enum:Res,
        default:'pending'
    }
})

reportSchema.plugin(AutoIncrement, {id:'report_seq',inc_field: 'id'});

reportSchema.virtual("reportId").get(function () {
    return `REPORT-${this.id.toString().padStart(3, "0")}`;
  });
  
  // Ensure virtuals are included when converting to JSON
  reportSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("report", reportSchema);