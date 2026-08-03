// // // var pickndrop = require("../models/PickupnDrop");
// // // const customers = require("../models/customer_model");
// // // const jwt_decode = require("jwt-decode");
// // // const otpAuth = require("../helper/otpAuth");
// // // const Dealer = require("../models/Dealer");

// // // async function PicknDrop(req, res) {
// // //     try {
// // //         const data = jwt_decode(req.headers.token);
// // //         const user_ids = data.user_id;
// // //         const user_type = data.user_type;

// // //         if (user_ids == null || (user_type !== 1 && user_type !== 4)) {
// // //             return res.status(401).json({ status: 401, message: "Admin is unauthorized!" });
// // //         }

// // //         const { dealer_id, user_lat, user_lng } = req.body;

// // //         let dealer = await Dealer.findById(dealer_id);
// // //         if (!dealer) {
// // //             return res.status(401).json({ error: "No Dealer Found" });
// // //         }

// // //         let user = await customers.findById(user_ids);
// // //         if (!user) {
// // //             return res.status(401).json({ error: "No User Found" });
// // //         }

// // //         // User & provider mobile numbers
// // //         const sphone = dealer.phone;
// // //         const uphone = user.phone;

// // //         // Prepare data for insertion
// // //         const datas = {
// // //             dealer_id: dealer_id,
// // //             user_id: user_ids,
// // //             service_provider_lat: dealer.latitude,  // Replacing dealer_address
// // //             service_provider_lng: dealer.longitude, // Replacing dealer_address
// // //             user_lat: user_lat,  // Replacing user_address
// // //             user_lng: user_lng   // Replacing user_address
// // //         };

// // //         const pickndropResponse = await pickndrop.create(datas);

// // //         if (pickndropResponse) {
// // //             const otpData = await otpAuth.pickndropotp(sphone, uphone, dealer.latitude, dealer.longitude, user_lat, user_lng);
// // //             pickndropResponse.otp = otpData.otp;

// // //             return res.status(200).json({
// // //                 status: 200,
// // //                 message: "Pick and drop added successfully",
// // //                 data: pickndropResponse,
// // //                 image_base_url: process.env.BASE_URL
// // //             });
// // //         } else {
// // //             return res.status(201).json({ status: 201, message: "Unable to add Pick and Drop" });
// // //         }

// // //     } catch (error) {
// // //         console.error("Error in PicknDrop:", error);
// // //         return res.status(500).json({ status: 500, message: "Operation was not successful" });
// // //     }
// // //   }

// // // module.exports = { PicknDrop }

// // // route: router.post('/addpickndrop', PicknDrop);
// // const pickndrop = require("../models/PickupnDrop");
// // const customers = require("../models/customer_model");
// // const jwt_decode = require("jwt-decode"); // keeping your current approach
// // const otpAuth = require("../helper/otpAuth");
// // const Dealer = require("../models/Dealer");
// // const mongoose = require("mongoose");

// // async function PicknDrop(req, res) {
// //   try {
// //     // ---- Token: support both Authorization: Bearer and headers.token
// //     const rawAuth = req.headers.authorization || req.headers.token || "";
// //     const token = rawAuth.startsWith("Bearer ") ? rawAuth.slice(7) : rawAuth;

// //     if (!token) {
// //       return res.status(401).json({ status: 401, message: "Missing token" });
// //     }

// //     let data;
// //     try {
// //       data = jwt_decode(token); // NOTE: consider jsonwebtoken.verify in future
// //     } catch (e) {
// //       return res.status(401).json({ status: 401, message: "Invalid token" });
// //     }

// //     const user_ids = data.user_id;
// //     const user_type = data.user_type;

// //     if (!user_ids || (user_type !== 1 && user_type !== 4)) {
// //       return res.status(401).json({ status: 401, message: "Admin is unauthorized!" });
// //     }

// //     const { dealer_id, user_lat, user_lng } = req.body;

// //     // ---- Basic validation
// //     if (!dealer_id || !mongoose.isValidObjectId(dealer_id)) {
// //       return res.status(400).json({ status: 400, message: "Invalid dealer_id" });
// //     }
// //     const lat = Number(user_lat);
// //     const lng = Number(user_lng);
// //     if (
// //       Number.isNaN(lat) || Number.isNaN(lng) ||
// //       lat < -90 || lat > 90 || lng < -180 || lng > 180
// //     ) {
// //       return res.status(400).json({ status: 400, message: "Invalid coordinates" });
// //     }

// //     const dealer = await Dealer.findById(dealer_id).select("phone latitude longitude");
// //     if (!dealer) {
// //       return res.status(404).json({ status: 404, message: "No Dealer Found" });
// //     }

// //     const user = await customers.findById(user_ids).select("phone");
// //     if (!user) {
// //       return res.status(404).json({ status: 404, message: "No User Found" });
// //     }

// //     // ---- Phones (optional if otp service needs them)
// //     const sphone = dealer.phone;
// //     const uphone = user.phone;

// //     // ---- Generate OTP *before* create so we persist it
// //     // If your otpAuth returns { otp, ... }
// //     let otpValue = null;
// //     try {
// //       const otpData = await otpAuth.pickndropotp(
// //         sphone,
// //         uphone,
// //         dealer.latitude,  // your helper seems to want these
// //         dealer.longitude,
// //         lat,
// //         lng
// //       );
// //       otpValue = otpData?.otp ?? null;
// //     } catch (e) {
// //       // If OTP service fails, you can still proceed or fail fast; choose policy.
// //       // Here we proceed but log it.
// //       console.error("pickndrop otp error:", e);
// //     }

// //     // ---- Only fields that exist in the schema
// //     const docToCreate = {
// //       dealer_id,
// //       user_id: user_ids,
// //       user_lat: lat,
// //       user_lng: lng,
// //       ...(otpValue !== null ? { otp: otpValue } : {}),
// //     };

// //     const created = await pickndrop.create(docToCreate);

// //     return res.status(200).json({
// //       status: 200,
// //       message: "Pick and drop added successfully",
// //       data: created,
// //       image_base_url: process.env.BASE_URL || null
// //     });

// //   } catch (error) {
// //     console.error("Error in PicknDrop:", error);
// //     return res.status(500).json({ status: 500, message: "Operation was not successful" });
// //   }
// // }

// // module.exports = { PicknDrop };

// // route: router.post('/addpickndrop', PicknDrop);

// const pickndrop = require("../models/PickupnDrop");
// const customers = require("../models/customer_model");
// const otpAuth = require("../helper/otpAuth");
// const Dealer = require("../models/Dealer");
// const mongoose = require("mongoose");

// async function PicknDrop(req, res) {
//     try {
//         const { dealer_id, user_id, user_lat, user_lng } = req.body;
//         console.log("Body", req.body)
//         // ---- Validate required fields
//         if (!dealer_id || !mongoose.isValidObjectId(dealer_id)) {
//             return res.status(400).json({ status: 400, message: "Invalid dealer_id" });
//         }
//         if (!user_id || !mongoose.isValidObjectId(user_id)) {
//             return res.status(400).json({ status: 400, message: "Invalid user_id" });
//         }

//         const lat = Number(user_lat);
//         const lng = Number(user_lng);
//         if (
//             Number.isNaN(lat) || Number.isNaN(lng) ||
//             lat < -90 || lat > 90 || lng < -180 || lng > 180
//         ) {
//             return res.status(400).json({ status: 400, message: "Invalid coordinates" });
//         }

//         // ---- Fetch dealer & user
//         const dealer = await Dealer.findById(dealer_id).select("phone latitude longitude");
//         if (!dealer) {
//             return res.status(404).json({ status: 404, message: "No Dealer Found" });
//         }

//         const user = await customers.findById(user_id).select("phone");
//         if (!user) {
//             return res.status(404).json({ status: 404, message: "No User Found" });
//         }

//         // ---- Generate OTP (optional: if service fails, proceed without otp)
//         let otpValue = null;
//         try {
//             const otpData = await otpAuth.pickndropotp(
//                 dealer.phone,
//                 user.phone,
//                 dealer.latitude,
//                 dealer.longitude,
//                 lat,
//                 lng
//             );
//             otpValue = otpData?.otp ?? null;
//         } catch (e) {
//             console.error("pickndrop otp error:", e);
//         }

//         // ---- Create only fields that exist in schema
//         const created = await pickndrop.create({
//             dealer_id,
//             user_id,
//             user_lat: lat,
//             user_lng: lng,
//             ...(otpValue !== null ? { otp: otpValue } : {}),
//         });

//         return res.status(200).json({
//             status: 200,
//             message: "Pick and drop added successfully",
//             data: created,
//             image_base_url: process.env.BASE_URL || null,
//         });
//     } catch (error) {
//         console.error("Error in PicknDrop:", error);
//         return res.status(500).json({ status: 500, message: "Operation was not successful" });
//     }
// }

// module.exports = { PicknDrop };

// route: router.post('/addpickndrop', PicknDrop)

const pickndrop = require("../models/PickupnDrop");
const customers = require("../models/customer_model");
const otpAuth = require("../helper/otpAuth");
const Dealer = require("../models/dealerModel");
const mongoose = require("mongoose");

async function PicknDrop(req, res) {
  try {
    const { dealer_id, user_lat, user_lng } = req.body;
    const user_id = req.user_id;

    // ---- Validate required fields
    if (!dealer_id || !mongoose.isValidObjectId(dealer_id)) {
      return res.status(400).json({ status: 400, message: "Invalid dealer_id" });
    }
    if (!user_id || !mongoose.isValidObjectId(user_id)) {
      return res.status(400).json({ status: 400, message: "Invalid user_id" });
    }

    const lat = Number(user_lat);
    const lng = Number(user_lng);
    if (
      Number.isNaN(lat) || Number.isNaN(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      return res.status(400).json({ status: 400, message: "Invalid coordinates" });
    }

    // ---- Fetch dealer & user
    const dealer = await Dealer.findById(dealer_id).select("phone latitude longitude");
    if (!dealer) return res.status(404).json({ status: 404, message: "No Dealer Found" });

    const user = await customers.findById(user_id).select("phone");
    if (!user) return res.status(404).json({ status: 404, message: "No User Found" });

    // ---- Extra guard for dealer's geo coords (in case of bad seed data)
    if (
      typeof dealer.latitude !== "number" ||
      typeof dealer.longitude !== "number" ||
      Number.isNaN(dealer.latitude) ||
      Number.isNaN(dealer.longitude)
    ) {
      return res.status(422).json({ status: 422, message: "Dealer coordinates not set" });
    }

    // ---- Generate OTP (best-effort)
    let otpValue = null;
    try {
      const otpData = await otpAuth.pickndropotp(
        dealer.phone,
        user.phone,
        dealer.latitude,
        dealer.longitude,
        lat,
        lng
      );
      otpValue = otpData?.otp ?? null;
    } catch (e) {
      console.error("pickndrop otp error:", e); // proceed without otp
    }

    // ---- Create only fields that exist in the PicknDrop schema
    const created = await pickndrop.create({
      dealer_id,
      user_id,
      user_lat: lat,
      user_lng: lng,
      ...(otpValue !== null ? { otp: otpValue } : {}),
    });

    return res.status(200).json({
      status: 200,
      message: "Pick and drop added successfully",
      data: created,
      image_base_url: process.env.BASE_URL || null,
    });
  } catch (error) {
    console.error("Error in PicknDrop:", error);
    return res.status(500).json({ status: 500, message: "Operation was not successful" });
  }
}

module.exports = { PicknDrop };
