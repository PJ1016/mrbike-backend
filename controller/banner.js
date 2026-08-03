// const Banner = require("../models/banner_model");
// const jwt_decode = require("jwt-decode");
// const mongoose = require("mongoose")
// // const sharp = require('sharp');
// // sharp.cache(false); // changes
// const Dealer = require("../models/Dealer")

// // Add Banner
// async function addbanner(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;
//     const user_type = data.user_type;

//     if (user_id == null || (user_type != 1 && user_type != 3)) {
//       return res.status(401).send({ status: 401, message: "admin is un-authorised !" });
//     }

//     const { name, from_date, expiry_date } = req.body;

//     if (!from_date || !expiry_date) {
//       return res.status(400).send({ status: 400, message: "From date and expiry date are required" });
//     }

//     if (new Date(from_date) >= new Date(expiry_date)) {
//       return res.status(400).send({ status: 400, message: "From date must be before expiry date" });
//     }

//     if (!req.file) {
//       return res.status(201).send({ status: 201, message: "please upload banner image" });
//     }

//     const bannerData = {
//       name: name,
//       banner_image: req.file.filename,
//       from_date: new Date(from_date),
//       expiry_date: new Date(expiry_date),
//     };

//     const bannerResponse = await Banner.create(bannerData);

//     if (bannerResponse) {
//       return res.status(200).send({ status: 200, message: "banner added successfully" });
//     } else {
//       return res.status(201).send({ status: 201, message: "Unable to add banner" });
//     }
//   } catch (error) {
//     console.log("error", error);
//     return res.status(201).send({ status: 201, message: "Operation was not successful" });
//   }
// }



// async function bannerlist(req, res) {
//   try {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0); // Normalize to midnight for consistent comparisons

//     const banners = await Banner.find({
//       from_date: { $lte: today },
//       expiry_date: { $gte: today },
//     }).sort({ _id: -1 });

//     return res.status(200).send({
//       status: 200,
//       message: "success",
//       data: banners,
//       image_base_url: process.env.BASE_URL,
//     });
//   } catch (error) {
//     console.error("Banner list fetch error:", error);
//     return res.status(500).send({
//       status: 500,
//       message: "Failed to fetch banner list. Please try again.",
//     });
//   }
// }




// async function deletebanner(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;
//     const user_type = data.user_type;
//     const type = data.type;
//     if (user_id == null || user_type != 1) {
//       if (user_type === 3) {
//         var response = {
//           status: 201,
//           message: "SubAdmin is un-authorised !",
//         };
//         return res.status(201).send(response);
//       } else {
//         var response = {
//           status: 401,
//           message: "Admin is un-authorised !",
//         };
//         return res.status(401).send(response);
//       }
//     }

//     const { banner_id } = req.body;
//     const manufactureRes = await Banner.findOne({ _id: banner_id });
//     if (manufactureRes) {
//       Banner.findByIdAndDelete({ _id: banner_id }, async function (err, docs) {
//         if (err) {
//           var response = {
//             status: 201,
//             message: "banner delete failed",
//           };
//           return res.status(201).send(response);
//         } else {
//           var response = {
//             status: 200,
//             message: "banner deleted successfully",
//           };
//           return res.status(200).send(response);
//         }
//       });
//     } else {
//       var response = {
//         status: 201,
//         message: "banner not Available",
//       };

//       return res.status(201).send(response);
//     }
//   } catch (error) {
//     console.log("error", error);
//     response = {
//       status: 201,
//       message: "Operation was not successful",
//     };
//     return res.status(201).send(response);
//   }
// }


// async function editbanner(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;
//     const user_type = data.user_type;

//     if (user_id == null || user_type != 1) {
//       const message = user_type === 3 ? "SubAdmin is un-authorised !" : "Admin is un-authorised !";
//       return res.status(user_type === 3 ? 201 : 401).send({ status: user_type === 3 ? 201 : 401, message });
//     }

//     const { banner_id, name, banner_image, from_date, expiry_date } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(banner_id)) {
//       return res.status(400).send({ status: 400, message: "Invalid banner_id" });
//     }

//     if (!from_date || !expiry_date) {
//       return res.status(400).send({ status: 400, message: "From date and expiry date are required" });
//     }

//     if (new Date(from_date) >= new Date(expiry_date)) {
//       return res.status(400).send({ status: 400, message: "From date must be before expiry date" });
//     }

//     const bannerRes = await Banner.findOne({ _id: banner_id });
//     if (!bannerRes) {
//       return res.status(201).send({ status: 201, message: "banner not available" });
//     }

//     const updateData = {
//       name,
//       banner_image,
//       from_date: new Date(from_date),
//       expiry_date: new Date(expiry_date),
//     };

//     const updatedBanner = await Banner.findByIdAndUpdate(
//       { _id: banner_id },
//       { $set: updateData },
//       { new: true }
//     );

//     return res.status(200).send({
//       status: 200,
//       message: "banner updated successfully",
//       data: updatedBanner,
//     });

//   } catch (error) {
//     console.log("error", error);
//     return res.status(201).send({ status: 201, message: "Operation was not successful" });
//   }
// }



// module.exports = {
//   addbanner,
//   bannerlist,
//   deletebanner,
//   editbanner,
// };



const Banner = require("../models/banner_model");
const {
  syncLegacyBanner,
  deleteSyncedLegacyBanner,
} = require("../services/legacyBannerSyncService");
const BaseService = require("../models/baseService");
const jwt_decode = require("jwt-decode");
const mongoose = require("mongoose");

// Shared validation for baseServiceId + location fields (used by create & edit)
async function validateBannerMappingFields({ baseServiceId, locationType, latitude, longitude, radius }) {
  if (baseServiceId !== undefined && baseServiceId !== null && baseServiceId !== "") {
    if (!mongoose.Types.ObjectId.isValid(baseServiceId)) {
      return { error: "Invalid baseServiceId" };
    }
    const serviceExists = await BaseService.findById(baseServiceId);
    if (!serviceExists) {
      return { error: "Service not found for given baseServiceId" };
    }
  }

  if (locationType === "specific") {
    if (latitude === undefined || latitude === null || latitude === "" ||
        longitude === undefined || longitude === null || longitude === "" ||
        radius === undefined || radius === null || radius === "") {
      return { error: "latitude, longitude and radius are required when locationType is 'specific'" };
    }
  }

  return null;
}


// Add Banner
// async function addbanner(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;
//     const user_type = data.user_type;

//     if (user_id == null || (user_type != 1 && user_type != 3)) {
//       return res.status(401).send({ status: 401, message: "admin is un-authorised !" });
//     }

//     const { name, from_date, expiry_date } = req.body;

//     if (!from_date || !expiry_date) {
//       return res.status(400).send({ status: 400, message: "From date and expiry date are required" });
//     }

//     const fromDate = new Date(from_date);
//     const expiryDate = new Date(expiry_date);
//     if (fromDate >= expiryDate) {
//       return res.status(400).send({ status: 400, message: "From date must be before expiry date" });
//     }

//     if (!req.file) {
//       return res.status(400).send({ status: 400, message: "please upload banner image" });
//     }

//     // Determine status
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     let status = "upcoming";
//     if (today >= fromDate && today <= expiryDate) {
//       status = "active";
//     } else if (today > expiryDate) {
//       status = "expired";
//     }

//     const bannerData = {
//       name,
//       banner_image: req.file.filename,
//       from_date: fromDate,
//       expiry_date: expiryDate,
//       status,
//     };

//     const bannerResponse = await Banner.create(bannerData);
//     return res.status(200).send({
//       status: 200,
//       message: "banner added successfully",
//       data: bannerResponse,
//     });
//   } catch (error) {
//     console.error("error", error);
//     return res.status(500).send({ status: 500, message: "Operation was not successful" });
//   }
// }

// List only active banners
// async function bannerlist(req, res) {
//   try {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     const banners = await Banner.find({
//       from_date: { $lte: today },
//       expiry_date: { $gte: today },
//     }).sort({ _id: -1 });

//     return res.status(200).send({
//       status: 200,
//       message: "success",
//       data: banners,
//       image_base_url: process.env.BASE_URL,
//     });
//   } catch (error) {
//     console.error("Banner list fetch error:", error);
//     return res.status(500).send({
//       status: 500,
//       message: "Failed to fetch banner list. Please try again.",
//     });
//   }
// }

// Delete Banner
// async function deletebanner(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;
//     const user_type = data.user_type;

//     if (user_id == null || user_type != 1) {
//       const message = user_type === 3 ? "SubAdmin is un-authorised !" : "Admin is un-authorised !";
//       return res.status(user_type === 3 ? 201 : 401).send({ status: user_type === 3 ? 201 : 401, message });
//     }

//     const { banner_id } = req.body;
//     const banner = await Banner.findById(banner_id);
//     if (!banner) {
//       return res.status(404).send({ status: 404, message: "banner not available" });
//     }

//     await Banner.findByIdAndDelete(banner_id);
//     return res.status(200).send({ status: 200, message: "banner deleted successfully" });
//   } catch (error) {
//     console.log("error", error);
//     return res.status(500).send({ status: 500, message: "Operation was not successful" });
//   }
// }

// Edit Banner
async function editbanner(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;

    if (user_id == null || user_type != 1) {
      const message = user_type === 3 ? "SubAdmin is un-authorised !" : "Admin is un-authorised !";
      return res.status(user_type === 3 ? 201 : 401).send({ status: user_type === 3 ? 201 : 401, message });
    }

    const {
      banner_id, name, banner_image, from_date, expiry_date, status: statusOverride,
      baseServiceId, locationType, placeId, placeName, latitude, longitude, radius, displayOrder,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(banner_id)) {
      return res.status(400).send({ status: 400, message: "Invalid banner_id" });
    }

    if (!from_date || !expiry_date) {
      return res.status(400).send({ status: 400, message: "From date and expiry date are required" });
    }

    const fromDate = new Date(from_date);
    const expiryDate = new Date(expiry_date);
    if (fromDate >= expiryDate) {
      return res.status(400).send({ status: 400, message: "From date must be before expiry date" });
    }

    const bannerRes = await Banner.findById(banner_id);
    if (!bannerRes) {
      return res.status(404).send({ status: 404, message: "banner not available" });
    }

    // Effective locationType/lat/lng/radius = incoming value, falling back to existing banner
    const effectiveLocationType = locationType !== undefined ? locationType : bannerRes.locationType;
    const effectiveLatitude = latitude !== undefined ? latitude : bannerRes.latitude;
    const effectiveLongitude = longitude !== undefined ? longitude : bannerRes.longitude;
    const effectiveRadius = radius !== undefined ? radius : bannerRes.radius;

    const validationError = await validateBannerMappingFields({
      baseServiceId,
      locationType: effectiveLocationType,
      latitude: effectiveLatitude,
      longitude: effectiveLongitude,
      radius: effectiveRadius,
    });
    if (validationError) {
      return res.status(400).send({ status: 400, message: validationError.error });
    }

    // Recalculate status (unless explicitly overridden in the request)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let status = "upcoming";
    if (today >= fromDate && today <= expiryDate) {
      status = "active";
    } else if (today > expiryDate) {
      status = "expired";
    }
    if (statusOverride) {
      status = statusOverride;
    }

   const nextBannerImage = req.file?.location ||
     (banner_image
       ? (/^https?:\/\//i.test(banner_image) || banner_image.includes("uploads/")
         ? banner_image
         : `uploads/banners/${banner_image}`)
       : bannerRes.banner_image);

   const updateData = {
  name,
  banner_image: nextBannerImage,
  from_date: fromDate,
  expiry_date: expiryDate,
  status,
  baseServiceId: baseServiceId !== undefined ? (baseServiceId || null) : undefined,
  locationType,
  placeId,
  placeName,
  latitude,
  longitude,
  radius,
  displayOrder,
};


    const updatedBanner = await Banner.findByIdAndUpdate(banner_id, { $set: updateData }, { new: true });
    await syncLegacyBanner(updatedBanner);

    return res.status(200).send({
      status: 200,
      message: "banner updated successfully",
      data: updatedBanner,
    });
  } catch (error) {
    console.log("error", error);
    return res.status(500).send({ status: 500, message: "Operation was not successful" });
  }
}

// By Prashant 
async function addbanner(req, res) {
  try {
    const {
      name, from_date, expiry_date,
      baseServiceId, locationType, placeId, placeName, latitude, longitude, radius, displayOrder,
    } = req.body;

    if (!from_date || !expiry_date) {
      return res.status(400).send({ status: 400, message: "From date and expiry date are required" });
    }

    const fromDate = new Date(from_date);
    const expiryDate = new Date(expiry_date);
    if (fromDate >= expiryDate) {
      return res.status(400).send({ status: 400, message: "From date must be before expiry date" });
    }

    if (!req.file) {
      return res.status(400).send({ status: 400, message: "Please upload banner image" });
    }

    const validationError = await validateBannerMappingFields({
      baseServiceId,
      locationType: locationType || "all",
      latitude,
      longitude,
      radius,
    });
    if (validationError) {
      return res.status(400).send({ status: 400, message: validationError.error });
    }

    // Determine status
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let status = "upcoming";
    if (today >= fromDate && today <= expiryDate) {
      status = "active";
    } else if (today > expiryDate) {
      status = "expired";
    }

    const bannerData = {
      name,
      banner_image: req.file.location,
      from_date: fromDate,
      expiry_date: expiryDate,
      status,
      baseServiceId: baseServiceId || null,
      locationType: locationType || "all",
      placeId,
      placeName,
      latitude,
      longitude,
      radius,
      displayOrder,
    };

    const bannerResponse = await Banner.create(bannerData);
    await syncLegacyBanner(bannerResponse);
    return res.status(200).send({
      status: 200,
      message: "Banner added successfully",
      data: bannerResponse,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send({ status: 500, message: "Operation was not successful" });
  }
}

async function bannerlist(req, res) {
  try {
    const banners = await Banner.find()
      .populate("baseServiceId", "name image")
      .sort({ displayOrder: 1, _id: -1 });

    return res.status(200).send({
      status: 200,
      message: "Success",
      data: banners,
      image_base_url: process.env.BASE_URL,
    });
  } catch (error) {
    console.error("Banner list fetch error:", error);
    return res.status(500).send({
      status: 500,
      message: "Failed to fetch banner list. Please try again.",
    });
  }
}

async function deletebanner(req, res) {
  try {
    const { banner_id } = req.body;

    const banner = await Banner.findById(banner_id);
    if (!banner) {
      return res.status(404).send({ status: 404, message: "Banner not available" });
    }

    await Banner.findByIdAndDelete(banner_id);
    await deleteSyncedLegacyBanner(banner_id);
    return res.status(200).send({ status: 200, message: "Banner deleted successfully" });
  } catch (error) {
    console.log("error", error);
    return res.status(500).send({ status: 500, message: "Operation was not successful" });
  }
}


module.exports = {
  addbanner,
  bannerlist,
  deletebanner,
  editbanner,
};
