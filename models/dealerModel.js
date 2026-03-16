const mongoose = require("mongoose")
const AutoIncrement = require("mongoose-sequence")(mongoose)

const dealerModel = new mongoose.Schema(
  {
    id: { type: Number },
    shopName: { type: String, required: false },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
      validate: {
        validator: (v) => {
          if (!v) return true // allow empty when sparse
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        },
        message: (props) => `${props.value} is not a valid email!`,
      },
    },
    shopEmail: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
      validate: {
        validator: (v) => {
          if (!v) return true // allow empty when sparse
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        },
        message: (props) => `${props.value} is not a valid email!`,
      },
    },
    phone: { type: String, required: true, index: true },
    password: { type: String, required: false }, // if you support password login
    aadharCardNo: {
      type: String,
      required: false,
      validate: {
        validator: (v) => {
          if (!v) return true
          return /^\d{12}$/.test(v)
        },
        message: (props) => `${props.value} is not a valid Aadhar number!`,
      },
    },
    shopContact: { type: String, required: false },
    panCardNo: {
      type: String,
      required: false,
      uppercase: true,
      validate: {
        validator: (v) => {
          if (!v) return true
          return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v)
        },
        message: (props) => `${props.value} is not a valid PAN number!`,
      },
    },
    shopPincode: { type: String, required: false },
    fullAddress: { type: String, required: false },
    city: { type: String, required: false },
    state: { type: String, required: false },
    latitude: { type: Number, required: false },
    longitude: { type: Number, required: false },
    ownerName: { type: String, required: false },
    shopImages: [{ type: String }],
    personalEmail: { type: String, required: false },
    personalPhone: { type: String, required: false },
    holiday: { type: String, required: false },
    alternatePhone: { type: String, required: false },
    permanentAddress: {
      address: { type: String, required: false },
      state: { type: String, required: false },
      city: { type: String, required: false },
    },
    presentAddress: {
      address: { type: String, required: false },
      state: { type: String, required: false },
      city: { type: String, required: false },
    },
    documents: {
      panCardFront: { type: String, required: false },
      aadharFront: { type: String, required: false },
      aadharBack: { type: String, required: false },
      shopCertificate: { type: String, required: false },
      faceVerificationImage: { type: String, required: false },
    },
    bankDetails: {
      accountHolderName: { type: String, required: false },
      ifscCode: { type: String, required: false },
      bankName: { type: String, required: false },
      accountNumber: { type: String, required: false },
      passbookImage: { type: String, required: false },
    },
    commission: {
      type: Number,
      required: false,
      min: 0,
      max: 100,
      set: (v) => (v === undefined || v === null ? v : Number.parseFloat(v)),
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
      max: 18,
    },
    formProgress: {
      currentStep: { type: Number, default: 1 },
      completedSteps: {
        type: Map,
        of: Boolean,
        default: {
          basicInfo: false,
          locationInfo: false,
          shopDetails: false,
          documents: false,
          bankDetails: false,
        },
      },
      lastActiveStep: { type: Number, default: 1 },
    },
    completionTimestamps: {
      basicInfo: Date,
      locationInfo: Date,
      shopDetails: Date,
      documents: Date,
      bankDetails: Date,
    },
    registrationStatus: {
      type: String,
      enum: ["Draft", "Pending", "Approved", "Rejected"],
      default: "Pending",
      required: true,
    },
    adminNotes: String,
    submittedAt: Date,
    approvedAt: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    // OTP fields
    otp: String,
    otpExpiry: Date,

    // security
    loginAttempts: { type: Number, default: 0 },
    accountLockedUntil: Date,

    // booleans used elsewhere
    isVerify: { type: Boolean, default: false },
    isProfile: { type: Boolean, default: false },
    isDoc: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },

    // Explicit status object you want to query against
    status: {
      adminApproved: { type: Boolean, default: false },
      isActive: { type: Boolean, default: false },
      isVerified: { type: Boolean, default: false },
    },

    documentVerification: {
      aadhar: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none" },
      aadharFront: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none" },
      aadharBack: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none" },
      pan: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none" },
      bank: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none" },
      face: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none" },
      shop: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none" },
      passbook: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none" },
    },

    shopOpeningDate: { type: Date, required: false },
    businessHours: {
      open: String,
      close: String,
      days: [String],
    },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      app: { type: Boolean, default: true },
    },
    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AdminService",
      },
    ],
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Male",
    },
    dob: {
      type: Date,
      default: null,
    },
    online: { type: Boolean, default: false },

    // --- Creator metadata for admin/self created
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "creatorModel", // dynamic ref to 'Admin' or 'Vendor'
      required: false,
    },
    creatorModel: {
      type: String,
      enum: ["Admin", "Vendor", "System"],
      default: "Vendor",
    },
    creatorType: {
      // 'admin' | 'self' | 'system'
      type: String,
      enum: ["admin", "self", "system"],
      default: "self",
    },
    createdVia: { type: String, required: false }, // e.g. 'admin-panel', 'mobile', 'web'
  },
  { timestamps: true },
)

// indexes
dealerModel.index({ phone: 1, email: 1, registrationStatus: 1, creatorType: 1 })

// pre-save adjustments
dealerModel.pre("save", function (next) {
  // existing registrationStatus behavior:
  if (this.isModified("registrationStatus")) {
    if (this.registrationStatus === "Pending" && !this.submittedAt) {
      this.submittedAt = new Date()
    } else if (this.registrationStatus === "Approved" && !this.approvedAt) {
      this.approvedAt = new Date()
      this.isActive = true
    }
  }

  if (this.creatorType === "admin") {
    this.status = this.status || {}
    if (typeof this.status.adminApproved === "undefined") {
      this.status.adminApproved = true
    }
    if (typeof this.status.isActive === "undefined") {
      this.status.isActive = true
    }
    if (typeof this.status.isVerified === "undefined") {
      this.status.isVerified = this.isVerify || false
    }
    this.isActive = this.isActive || true
    this.isVerify = this.isVerify || Boolean(this.status.isVerified)
  }

  next()
})

dealerModel.plugin(AutoIncrement, { id: "dealer_seq", inc_field: "id" })

dealerModel.virtual("dealerId").get(function () {
  if (!this.id) return null
  return `MRBD${this.id.toString().padStart(4, "0")}`
})

dealerModel.set("toJSON", { virtuals: true })
dealerModel.set("toObject", { virtuals: true })

module.exports = mongoose.model("Vendor", dealerModel)
