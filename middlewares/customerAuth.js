const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Customer = require("../models/customer_model");
const Booking = require("../models/Booking");
const UserBike = require("../models/userBikeModel");

function extractToken(req) {
  const authorization = req.headers.authorization;
  if (authorization && authorization.startsWith("Bearer ")) return authorization.slice(7).trim();
  return req.headers.token || null;
}

async function requireCustomer(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, status: false, message: "Token not provided" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_error) {
    return res.status(401).json({ success: false, status: false, message: "Authentication failed" });
  }

  if (decoded.user_type !== 4 || !mongoose.Types.ObjectId.isValid(decoded.user_id)) {
    return res.status(403).json({ success: false, status: false, message: "Customer access required" });
  }

  try {
    const customer = await Customer.findById(decoded.user_id).select("_id status isBlocked").lean();
    if (!customer) return res.status(401).json({ success: false, status: false, message: "Customer account not found" });
    if (customer.isBlocked === true || customer.status === "inactive" || customer.status === 0) {
      return res.status(403).json({ success: false, status: false, message: "Customer account is inactive" });
    }
    req.user_id = String(customer._id);
    req.user_type = 4;
    req.auth = { role: "customer", id: String(customer._id) };
    return next();
  } catch (error) {
    console.error("requireCustomer error:", error.message);
    return res.status(500).json({ success: false, status: false, message: "Authorization check failed" });
  }
}

function requireOwnCustomerParam(paramName) {
  return function (req, res, next) {
    if (!req.user_id || String(req.params[paramName]) !== String(req.user_id)) {
      return res.status(403).json({ success: false, status: false, message: "Access denied" });
    }
    return next();
  };
}

function requireOwnCustomerBody(fieldName) {
  return function (req, res, next) {
    const supplied = req.body[fieldName];
    if (supplied != null && String(supplied) !== String(req.user_id)) {
      return res.status(403).json({ success: false, status: false, message: "Access denied" });
    }
    req.body[fieldName] = req.user_id;
    return next();
  };
}

function requireOwnedBooking(paramName) {
  return async function (req, res, next) {
    const bookingId = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, status: false, message: "Invalid booking ID" });
    }
    const owned = await Booking.exists({ _id: bookingId, user_id: req.user_id });
    if (!owned) return res.status(404).json({ success: false, status: false, message: "Booking not found" });
    return next();
  };
}

function requireOwnedBike(paramName) {
  return async function (req, res, next) {
    const bikeId = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(bikeId)) {
      return res.status(400).json({ success: false, status: false, message: "Invalid bike ID" });
    }
    const owned = await UserBike.exists({ _id: bikeId, user_id: req.user_id });
    if (!owned) return res.status(404).json({ success: false, status: false, message: "Bike not found" });
    return next();
  };
}

module.exports = {
  requireCustomer,
  requireOwnCustomerParam,
  requireOwnCustomerBody,
  requireOwnedBooking,
  requireOwnedBike,
};
