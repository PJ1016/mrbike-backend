// // const mongoose = require("mongoose");
// // const AutoIncrement = require('mongoose-sequence')(mongoose);

// // const DealerSchema = new mongoose.Schema ({
// //     id:{
// //       type:Number,
// //     },
// //     name: {type: String, required: true},
// //     email: {type: String, unique: true, lowercase: true, required: true},
// //     password: {
// //       type:String,
// //       select:false,
// //       required: true
// //     },
// //     device_token:{
// //       type: String,
// //     },
// //     is_online: {
// //       type: String,
// //       default: "off"
// //     },
// //     phone: {type: Number, unique: true, required: true},
// //     extra_charges: Number,
// //     state: [String],
// //     city: String,
// //     area: String,
// //     address: String,
// //     latitude: Number,
// //     longitude: Number, 
// //     create_by: String,
// //     otp:Number,
// //     ftoken:String,
// //     profileImage:String,
// //     accholdername:String,
// //     accountno:String,

// //     bankname: String,
// //     ifsc: String,
// //     location: String,

// //     passportImage:String,
// //     PassbookImage:String,
// //     isVerify:{
// //       type:Boolean,
// //       default:false
// //     },
// //     images: { type: String },
// //     wallet:{
// //       type:Number,
// //       default:0

// //     },
// //     commission : {
// //       type:Number,
// //       default : 10
// //     },
// //     isBlock:{
// //       type:Boolean,
// //       default:false
// //     },
// //     shopName: String, // New field
// //     shopImages: [{ type: String }], // Updated to support multiple images
// //     shopDescription: String, // New field
// //     beneficiary_id:{
// //       type:String,
// //       default:""
// //     },
// //     beneficiary_accountNo:{
// //       type:String,
// //       default:""
// //     },
// //     beneficiary_ifsc:{
// //       type:String,
// //       default:""
// //     },
// //     services: [
// //       {
// //         type: mongoose.Schema.Types.ObjectId,
// //         ref: "service",
// //       }
// //     ],
// //     bikes: [ 
// //       {
// //         type: mongoose.Schema.Types.ObjectId,
// //         ref: "bike",
// //       }
// //     ],
// //     isProfile: {
// //       type: Boolean,
// //       default: false
// //   },
// //     isDoc:{
// //       type: Boolean,
// //       default: false
// //   },
// //     pickupAndDrop: { type: Boolean, default: false }, // New field
// //     pickupAndDropDescription: String, // New field
// //     goDigital: { type: Boolean, default: false },
// //     expertAdvice: { type: String, default: "Expert guidance for vehicle maintenance" }, 
// //     ourPromise: { type: String, default: "100% satisfaction guaranteed" },
// //     isShopDetailsAdded: { type: Boolean, default: false },
// //     businessEmail: { type: String, default: "" },
// //     shopPhone: { type: String, default: "" },
// //     shopState: { type: String, default: "" },   
// //     shopCity: { type: String, default: "" },    
// //     shopPinCode: { type: String, default: "" }, 
// //     aadharCardNo: { type: Number, unique: true, },
// //     adharCardFront: { type: String, default: "" }, 
// //     adharCardBack: { type: String, default: "" }, 
// //     panCardNo: {type: String, unique: true, upperCase: true}, 
// //     panCardFront: { type: String, default: "" },  
// //     panCardBack: { type: String, default: "" },  
// //     GST: { type: String, default: "" },  
// //     isDocumentsAdded: { type: Boolean, default: false },  
// //   },

// // {
// //   timestamps:true,
// // }
// // );

// // // DealerSchema.plugin(AutoIncrement);

// // DealerSchema.plugin(AutoIncrement, {id:'dealer_seq',inc_field: 'id'});

// // module.exports = mongoose.model("dealer", DealerSchema);

// const mongoose = require("mongoose");

// const DealerSchema = new mongoose.Schema({
//   // Auth & Basic Info
//   shopName: { type: String, required: true },
//   shopEmail: { type: String, required: true },
//   shopContact: { type: String, required: true },
//   password: { type: String, required: true },

//   // Location Details
//   shopPincode: { type: String, required: true },
//   fullAddress: { type: String, required: true },
//   city: { type: String, required: true },
//   state: { type: String, required: true },
//   latitude: { type: Number, required: true },
//   longitude: { type: Number, required: true },

//   // Owner Info
//   ownerName: { type: String, required: true },

//   // Shop Images
//   shopImages: [{ type: String, required: true }],

//   // Personal Info
//   personalEmail: { type: String, required: true },
//   personalPhone: { type: String, required: true },
//   alternatePhone: { type: String, required: true },

//   // Permanent Address
//   permanentAddress: { type: String, required: true },
//   permanentState: { type: String, required: true },
//   permanentCity: { type: String, required: true },

//   // Present Address
//   presentAddress: { type: String, required: true },
//   presentState: { type: String, required: true },
//   presentCity: { type: String, required: true },

//   // Document Uploads
//   panCardFront: { type: String, required: true },
//   panCardBack: { type: String },
//   adharCardFront: { type: String, required: true },
//   adharCardBack: { type: String, required: true },
//   passportImage: { type: String },
//   PassbookImage: { type: String, required: true },

//   // Bank Info
//   accountHolderName: { type: String, required: true },
//   ifscCode: { type: String, required: true },
//   bankName: { type: String, required: true },
//   accountNumber: { type: String, required: true },

//   // // System & Meta
//   // images: { type: String }, // extra field
//   // create_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
//   // isVerify: { type: Boolean, default: false },
//   // isProfile: { type: Boolean, default: false },
//   // isDoc: { type: Boolean, default: false },
//   // goDigital: { type: Boolean, default: false },
//   // isShopDetailsAdded: { type: Boolean, default: false },
//   // isDocumentsAdded: { type: Boolean, default: false }
// }, {
//   timestamps: true
// });

// module.exports = mongoose.model("Dealer", DealerSchema);

const mongoose = require("mongoose");

const DealerSchema = new mongoose.Schema({
  shopName: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    index: true,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email!`
    }
  },
  phone: { type: String, required: true },
  password: { type: String, required: false },
  aadharCardNo: { type: Number, required: false },
  shopPincode: { type: String, required: true },
  fullAddress: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },

  ownerName: { type: String, required: true },

  shopImages: [{ type: String }],

  personalEmail: { type: String, required: false },
  personalPhone: { type: String, required: false },
  alternatePhone: { type: String, required: false },

  permanentAddress: {
    address: { type: String, required: false },
    state: { type: String, required: false },
    city: { type: String, required: false }
  },
  presentAddress: {
    address: { type: String, required: false },
    state: { type: String, required: false },
    city: { type: String, required: false }
  },

  documents: {
    panCardFront: { type: String, required: true },
    aadharFront: { type: String, required: true },
    aadharBack: { type: String, required: true },
    passbookImage: { type: String, required: true }
  },

  bankDetails: {
    accountHolderName: { type: String, required: true },
    ifscCode: { type: String, required: true },
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true }
  },

  isVerify: { type: Boolean, default: false },
  isProfile: { type: Boolean, default: true },
  isDoc: { type: Boolean, default: false },
}, { timestamps: true });

// DealerSchema.index({ shopEmail: 1 }, { 
//   unique: true,
//   partialFilterExpression: {
//     shopEmail: { $exists: true, $ne: null }
//   }
// });

module.exports = mongoose.model("Dealer", DealerSchema);