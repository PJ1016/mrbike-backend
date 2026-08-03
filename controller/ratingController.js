const jwt_decode = require("jwt-decode");
const booking = require("../models/Booking");
const additionaloptions = require("../models/additionalOptionsModel");
const service = require("../models/service_model");
const bike = require("../models/bikeModel");
const Tracking = require("../models/Tracking");
const customers = require("../models/customer_model");
const Review = require("../models/rating_model");
const { Notification } = require("../helper/pushNotification");
const mongoose = require("mongoose");

async function addreview(req, res) {

  const {dealer_id,rating,comment,review,reason }= req.body
  console.log(req.body);

  try {
    const user_id = req.user_id;
    const numericRating = Number(rating);
    if (!mongoose.Types.ObjectId.isValid(dealer_id) || !Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ status: 400, message: "Valid dealer_id and rating from 1 to 5 are required" });
    }
    const hasCompletedBooking = await booking.exists({
      user_id,
      dealer_id,
      status: { $in: ["completed", "delivered", "cash received", "Payment"] },
    });
    if (!hasCompletedBooking) {
      return res.status(403).json({ status: 403, message: "A completed booking is required before rating this dealer" });
    }
    // if (user_id == null || user_type != 1 && user_type != 3) {
    //   var response = {
    //     status: 401,
    //     message: "admin is un-authorised !",
    //   };
    //   return res.status(401).send(response);
    // }

      const sendData = {
        user_id,
        dealer_id,
        rating: numericRating,
        comment,
        review,
        reason
      };

      console.log(sendData);

      const reviewresponce = await Review.create(sendData);

      if (reviewresponce) {
        var response = {
          status: 200,
          message: "rating added successfully",
          data: reviewresponce
          // data: sendData
          
        };
        return res.status(200).send(response);
      } else {
        var response = {
          status: 201,
          message: "Unable to add rating",
        };
        return res.status(201).send(response);
      }
    
  } catch (error) {
    console.log("error", error);
    response = {
      status: 201,
      message: "Operation was not successful",
    };

    return res.status(201).send(response);
  }
}

async function getallreview(req, res) {
  try {
    // if (user_id == null || user_type != 1 && user_type != 2 && user_type != 3) {
    //   var response = {
    //     status: 401,
    //     message: "admin is un-authorised !",
    //   };
    //   return res.status(401).send(response);
    // }

    // const apiFeature = new ApiFeatures(booking.find(), req.query)
    // .search()
    // .filter();

    // let bookingresponce = await apiFeature.query;
    // // console.log(log);
    // bookingresponce = await apiFeature.query.clone();

    const reviewresponce = await Review.find(req.query)
      .populate({ path: "user_id", select: ['first_name','last_name', 'image','id'] })
      .populate({ path: "dealer_id", select: ['name', 'image','id'] })
      // .populate({ path: "created_by", select: ['first_name', 'last_name', 'email', 'phone', 'image', 'address', 'city'] })
      .sort({ "_id": -1 });

    if (reviewresponce) {
      var response = {
        status: 200,
        message: "successfull",
        data: reviewresponce,
      };
      return res.status(200).send(response);
    } else {
      var response = {
        status: 201,
        reviewresponce,
        message: "No review Found",
      };
      return res.status(201).send(response);
    }
  } catch (error) {
    console.log("error", error);
    response = {
      status: 201,
      message: "Operation was not successful",
    };
    return res.status(201).send(response);
  }
}

module.exports = {
    addreview,
    getallreview
};
