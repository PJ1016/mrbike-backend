require("dotenv").config();
const Dealer = require("../models/Dealer");
const Service = require("../models/service_model");
const Vendor = require("../models/dealerModel");
const jwt_decode = require("jwt-decode");
var validation = require("../helper/validation");
const Rating = require("../models/rating_model");
const Wallet = require("../models/Wallet_modal")
const Role = require('../models/Roles_modal')
const Admin = require('../models/admin_model')
const Bike = require('../models/bikeCompanyModel')
const UserBike = require("../models/userBikeModel")
const servicess = require("../models/service_model")
const AdminService = require("../models/adminService")
const fs = require("fs");
const mongoose = require('mongoose');
const { log } = require("console");

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance;
}


async function checkPermission(user_id, requiredPermission) {
  try {
    const userRole = await Role.findOne({ subAdmin: user_id });
    console.log(userRole, "1")
    if (!userRole) {
      return false;
    }
    const permissions = userRole.permissions;
    console.log(permissions, "2")

    const [module, permission] = requiredPermission.split('.');

    // Check if the module and permission exist in permissions object
    if (!permissions || !permissions[module] || !permissions[module][permission]) {
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error while checking permission:", error);
    return false;
  }
}

const dealerWithInRange = async (req, res) => {
  try {
    const { userLat, userLon } = req.query;

    if (!userLat || !userLon) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required."
      });
    }

    const latitude = parseFloat(userLat);
    const longitude = parseFloat(userLon);

    console.log(`📍 Searching dealers near lat: ${latitude}, lon: ${longitude}`);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude."
      });
    }

    const dealers = await Vendor.find({
      is_online: "on",
      online: true, 
      wallet: { $gt: -500 },
      isBlock: false,
      latitude: { $gte: latitude - 0.03, $lte: latitude + 0.03 },
      longitude: { $gte: longitude - 0.03, $lte: longitude + 0.03 },
    });

    console.log(`✅ Total Dealers Found: ${dealers}`);

    const nearbyDealers = dealers.filter(dealer => {
      const distance = calculateDistance(
        latitude,
        longitude,
        dealer.latitude,
        dealer.longitude
      );
      return distance <= 3;
    });

    return res.status(200).json({
      success: true,
      data: nearbyDealers
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
};

// Helper: Calculate distance (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

const dealerWithInRange2 = async (req, res) => {
  try {
    const { userLat, userLon, variant_id } = req.query;

    if (!userLat || !userLon || !variant_id) {
      return res.status(200).json({ success: false, message: "User location (latitude & longitude) and variant_id are required!" });
    }

    console.log(`📍 Searching dealers near lat: ${userLat}, lon: ${userLon} with variant_id: ${variant_id}`);

    // Step 1: Fetch all active dealers within 3km and ensure they are not blocked
    const dealers = await Dealer.find({
      is_online: "on",
      wallet: { $gt: -500 },
      isBlock: false
    });

    console.log(`✅ Total Dealers Found: ${dealers.length}`);

    // Step 2: Filter dealers within 3km radius
    const nearbyDealers = dealers.filter((dealer) => {
      const distance = calculateDistance(
        parseFloat(userLat),
        parseFloat(userLon),
        parseFloat(dealer.latitude),
        parseFloat(dealer.longitude)
      );
      return distance <= 3;
    });

    console.log(`✅ Nearby Dealers Count: ${nearbyDealers.length}`);

    // Step 3: Check if dealer's bikes array contains the given `variant_id`
    const dealersWithMatchingBikes = nearbyDealers.filter((dealer) => {
      return dealer.bikes.some((bikeId) => bikeId.toString() === variant_id);
    });

    if (dealersWithMatchingBikes.length === 0) {
      return res.status(200).json({ success: false, message: "No dealers found with this bike variant!", data: [] });
    }

    console.log("✅ Final Dealers Response:", dealersWithMatchingBikes);
    res.status(200).json({ success: true, data: dealersWithMatchingBikes });

  } catch (error) {
    console.error("❌ Error fetching nearby dealers:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

async function addAmount(req, res) {
  try {
    const dealerId = req.params.id;
    const orderAmount = 100;

    const dealer = await Dealer.findById(dealerId);
    console.log(dealer)

    if (!dealer) {
      return res.status(200).json({ success: false, message: 'Dealer not found' });
    }

    dealer.wallet += orderAmount;

    await dealer.save();

    return res.status(200).json({ success: true, message: 'Amount added successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}




// p end

async function addDealer1(req, res) {
  // created by  store or vendor
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || (user_type != 1 && user_type != 3)) {
      var response = {
        status: 200,
        message: "admin is un-authorised !",
      };
      return res.status(200).send(response);
    }
    const {
      dealer_id,
      name,
      description,
      estimated_cost,
      tax,
      area,
      city,
      dealerId,
    } = req.body;

    let dealers = await Dealer.findById(dealer_id);
    if (!dealers) {
      res.status(200).json({ error: "No Service exists" });
      return;
    }

    if (req.file) {
      const data = {
        dealer_id: dealer_id,
        dealerId: dealerId,
        image: req.file.location, // S3 URL
        name: name,
        description: description,
        area: area,
        city: city,
        estimated_cost: estimated_cost,
        tax: tax,
        // dealerId,
      };
      console.log(data);

      const serviceResponse = await service.create(data);
      // console.log('serviceResponse', serviceResponse)

      if (serviceResponse) {
        var response = {
          status: 200,
          message: "service added successfully",
          data: serviceResponse,
        };
        return res.status(200).send(response);
      } else {
        var response = {
          status: 201,
          message: "Unable to add service",
        };
        return res.status(201).send(response);
      }
    } else {
      var response = {
        status: 201,
        message: "please upload service image",
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

async function editDealer(req, res) {
  try {
    const dealerId = req.body.id;

    // Find existing dealer
    const existingDealer = await Vendor.findById(dealerId);
    console.log("Existing Dealer", existingDealer)
    if (!existingDealer) {
      return res.status(404).json({
        success: false,
        message: "Dealer not found"
      });
    }

    // Extract all possible fields (same as addDealer)
    const {
      shopName,
      email,
      phone,
      shopPincode,
      fullAddress,
      city,
      state,
      latitude,
      longitude,
      ownerName,
      personalEmail,
      personalPhone,
      alternatePhone,
      permanentAddress,
      permanentState,
      permanentCity,
      presentAddress,
      presentState,
      presentCity,
      accountHolderName,
      ifscCode,
      bankName,
      accountNumber,
      comission: commissionInput,
      tax,
      aadharCardNo,
      panCardNo
    } = req.body;

    // Validate commission (same as addDealer)
    const commission = parseFloat(commissionInput);
    if (commissionInput && (isNaN(commission) || commission < 0 || commission > 100)) {
      return res.status(400).json({
        success: false,
        message: `Commission must be between 0-100%. Received: ${commissionInput}`
      });
    }

    // Validate tax (same as addDealer)
    const taxValue = tax ? parseFloat(tax) : existingDealer.tax;
    if (tax && (isNaN(taxValue) || taxValue < 0 || taxValue > 18)) {
      return res.status(400).json({
        success: false,
        message: `Tax must be between 0-18%. Received: ${tax}%`
      });
    }

    // Email format check (same as addDealer)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // PAN format check (same as addDealer)
    if (panCardNo && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panCardNo.trim().toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid PAN card number"
      });
    }

    // Aadhar format check (same as addDealer)
    if (aadharCardNo && !/^\d{12}$/.test(aadharCardNo.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid Aadhar card number"
      });
    }

    // Check for duplicate email/phone (excluding current dealer)
    if (email || phone) {
      const duplicate = await Vendor.findOne({
        $and: [
          { _id: { $ne: dealerId } },
          { $or: [] }
        ]
      });

      if (email) duplicate.$or.push({ email });
      if (phone) duplicate.$or.push({ phone });

      if (duplicate) {
        const conflictField = duplicate.email === email ? 'Shop Email' : 'Shop Contact';
        return res.status(409).json({
          success: false,
          message: `${conflictField} already exists`,
          field: conflictField.toLowerCase().replace(' ', '-')
        });
      }
    }

    // Prepare update data (similar to addDealer but only update provided fields)
    const updateData = {};

    // Text fields
    if (shopName) updateData.shopName = shopName;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    // ... add all other text fields similarly

    // Address fields
    if (permanentAddress || permanentState || permanentCity) {
      updateData.permanentAddress = {
        address: permanentAddress || existingDealer.permanentAddress.address,
        state: permanentState || existingDealer.permanentAddress.state,
        city: permanentCity || existingDealer.permanentAddress.city
      };
    }

    // Bank details
    if (accountHolderName || ifscCode || bankName || accountNumber) {
      updateData.bankDetails = {
        accountHolderName: accountHolderName || existingDealer.bankDetails.accountHolderName,
        ifscCode: ifscCode || existingDealer.bankDetails.ifscCode,
        bankName: bankName || existingDealer.bankDetails.bankName,
        accountNumber: accountNumber || existingDealer.bankDetails.accountNumber
      };
    }

    // Document handling (same file structure as addDealer)
    if (req.files) {
      updateData.documents = { ...existingDealer.documents };

      if (req.files.panCardFront) {
        updateData.documents.panCardFront =
  req.files.panCardFront[0].location; // S3 URL
        // Delete old file if exists
        if (existingDealer.documents.panCardFront) {
          fs.unlinkSync(path.join(uploadDir, existingDealer.documents.panCardFront));
        }
      }
      // Repeat for aadharFront, aadharBack
    }

    // Shop images (append new ones)
    if (req.files?.shopImages) {
      updateData.shopImages = [
        ...existingDealer.shopImages,
        ...req.files.shopImages.map(
  file => file.location // S3 URL
)

      ];
    }

    // Numeric fields
    if (commissionInput) updateData.commission = commission;
    if (tax) updateData.tax = taxValue;
    if (latitude) updateData.latitude = parseFloat(latitude);
    if (longitude) updateData.longitude = parseFloat(longitude);

    // Update the dealer
    const updatedDealer = await Vendor.findByIdAndUpdate(
      dealerId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Dealer updated successfully",
      data: {
        id: updatedDealer._id,
        shopName: updatedDealer.shopName,
        email: updatedDealer.email
      }
    });

  } catch (error) {
    console.error("Edit dealer error:", error);

    // Cleanup newly uploaded files if error occurs
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        try {
          if (file?.filename) {
            fs.unlinkSync(path.join(uploadDir, file.filename));
          }
        } catch (err) {
          console.error("File cleanup error:", err);
        }
      });
    }

    return res.status(500).json({
      success: false,
      message: "Update failed due to server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// async function singledealer(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;
//     const user_type = data.user_type;
//     const type = data.type;
//     if (
//       user_id == null ||
//       (user_type != 1 && user_type != 3 && user_type != 2)
//     ) {
//       var response = {
//         status: 200,
//         message: "admin is un-authorised !",
//       };
//       return res.status(200).send(response);
//     }

//     var dealerResposnse = await Dealer.findById(req.params.id)
//       .populate("services", "name image")
//     // .populate("BikeModel");

//     if (dealerResposnse) {
//       var response = {
//         status: 200,
//         message: "success",
//         data: dealerResposnse,
//       };
//       return res.status(200).send(response);
//     } else {
//       var response = {
//         status: 201,
//         message: "No Dealer Found",
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

async function singledealer(req, res) {
  try {
    // Directly fetch dealer by ID from params (no JWT check)
    const dealerResposnse = await Dealer.findById(req.params.id)
      .populate("services", "name image")
    // .populate("BikeModel");

    if (dealerResposnse) {
      const response = {
        status: 200,
        message: "success",
        data: dealerResposnse,
      };
      return res.status(200).send(response);
    } else {
      const response = {
        status: 201,
        message: "No Dealer Found",
      };
      return res.status(201).send(response);
    }
  } catch (error) {
    console.log("error", error);
    const response = {
      status: 201,
      message: "Operation was not successful",
    };
    return res.status(201).send(response);
  }
}

async function editDealerStatus(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;

    // const type = data.type;

    if (user_type === 3) {
      const subAdmin = await Admin.findById(user_id)

      if (!subAdmin) {
        var response = {
          status: 200,
          message: "Subadmin not found!",
        };
        return res.status(200).send(response);
      }

      if (user_type === 3) {
        const subAdmin = await Admin.findById(user_id)

        if (!subAdmin) {
          var response = {
            status: 200,
            message: "Subadmin not found!",
          };
          return res.status(200).send(response);
        }
      }

      const isAllowed = await checkPermission(user_id, "Dealers.update");

      if (!isAllowed) {
        var response = {
          status: 200,
          message: "Subadmin does not have permission to add dealers!",
        };
        return res.status(200).send(response);
      }


    }


    const { dealer_id, status, isBlock } = req.body;

    const datas = {
      is_online: status,
      isBlock

    };
    var where = { _id: dealer_id };

    Dealer.findByIdAndUpdate(
      where,
      { $set: datas },
      { new: true },
      async function (err, docs) {
        if (err) {
          var response = {
            status: 201,
            message: err,
          };
          return res.status(201).send(response);
        } else {
          var response = {
            status: 200,
            message: "status updated successfully",
            data: docs,
            // _url: process.env.BASE_URL + '/employee',
          };
          return res.status(200).send(response);
        }
      }
    );
  } catch (error) {
    console.log("error", error);
    response = {
      status: 201,
      message: "Operation was not successful",
    };
    return res.status(201).send(response);
  }
}

// async function getWallet(req, res) {
//   try {
//     // const data = jwt_decode(req.headers.token);
//     // const user_type = data.user_type;

//     // if (user_type !== 4) {
//     //   return res.status(200).json({ success: false, message: "Unauthorized access!" });
//     // }

//     const { dealer_id } = req.query;

//     if (!dealer_id) {
//       return res.status(200).json({ success: false, message: "Dealer ID is required!" });
//     }

//     // Fetch dealer details along with services
//     const dealer = await Vendor.findById(dealer_id)
//       .select("wallet")


//     if (!dealer) {
//       return res.status(200).json({ success: false, message: "Dealer not found!" });
//     }

//     // Fetch ratings for the dealer
//     const ratings = await Rating.find({ dealer_id: dealer_id });

//     // Calculate average rating
//     const totalRatings = ratings.length;
//     const sumRatings = ratings.reduce((acc, curr) => acc + curr.rating, 0);
//     const averageRating = totalRatings > 0 ? (sumRatings / totalRatings).toFixed(1) : "0.0";

//     return res.status(200).json({
//       success: true,
//       message: "wallet retrieved successfully!",
//       data: {
//         ...dealer.toObject(),
//         averageRating
//       }
//     });

//   } catch (error) {
//     console.error("Error in getShopDetails:", error);
//     return res.status(200).json({ success: false, message: "Internal server error!" });
//   }
// }

// async function getWallet(req, res) {
//   try {
//     let { dealer_id } = req.query;

//     dealer_id = (dealer_id ?? '').toString().trim();

//     const objectIdMatch = dealer_id.match(/^[Oo]bject[Ii]d\(["']?([a-fA-F0-9]{24})["']?\)$/);
//     if (objectIdMatch) dealer_id = objectIdMatch[1];

//     if (!dealer_id) {
//       return res.status(400).json({ success: false, message: "Dealer ID is required!" });
//     }
//     if (!mongoose.Types.ObjectId.isValid(dealer_id)) {
//       return res.status(400).json({ success: false, message: "Invalid dealer_id format!" });
//     }

//     const dealer = await Vendor.findById(dealer_id).select("wallet");
//     if (!dealer) {
//       return res.status(404).json({ success: false, message: "Dealer not found!" });
//     }

//     // 3) Ratings with the same sanitized id
//     const ratings = await Rating.find({ dealer_id });

//     const totalRatings = ratings.length;
//     const sumRatings = ratings.reduce((acc, curr) => acc + (Number(curr.rating) || 0), 0);
//     const averageRating = totalRatings > 0 ? (sumRatings / totalRatings).toFixed(1) : "0.0";

//     return res.status(200).json({
//       success: true,
//       message: "Wallet retrieved successfully!",
//       data: {
//         ...dealer.toObject(),
//         averageRating
//       }
//     });

//   } catch (error) {
//     console.error("Error in getWallet:", error);
//     return res.status(500).json({ success: false, message: "Internal server error!" });
//   }
// }

async function getWallet(req, res) {
  try {
    let { dealer_id } = req.query;

    dealer_id = (dealer_id ?? '').toString().trim();

    const objectIdMatch = dealer_id.match(/^[Oo]bject[Ii]d\(["']?([a-fA-F0-9]{24})["']?\)$/);
    if (objectIdMatch) dealer_id = objectIdMatch[1];

    if (!dealer_id) {
      return res.status(400).json({ success: false, message: "Dealer ID is required!" });
    }
    if (!mongoose.Types.ObjectId.isValid(dealer_id)) {
      return res.status(400).json({ success: false, message: "Invalid dealer_id format!" });
    }

    const dealer = await Vendor.findById(dealer_id).select("wallet");
    if (!dealer) {
      return res.status(404).json({ success: false, message: "Dealer not found!" });
    }

    // Ratings
    const ratings = await Rating.find({ dealer_id });

    const totalRatings = ratings.length;
    const sumRatings = ratings.reduce((acc, curr) => acc + (Number(curr.rating) || 0), 0);
    const averageRating = totalRatings > 0 ? (sumRatings / totalRatings).toFixed(1) : "0.0";

    return res.status(200).json({
      success: true,
      message: "Wallet retrieved successfully!",
      data: {
        ...dealer.toObject(),
        averageRating,
        walletAmount: dealer.wallet?.amount || dealer.wallet || 0
      }
    });

  } catch (error) {
    console.error("Error in getWallet:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
}

// const GetwalletInfo = async (req, res) => {
//   try {
//     const walletInfo = await Wallet.find({ dealer_id: req.params.id }).sort({ "_id": -1 })
//       .populate({
//         path: 'dealer_id',
//         select: ['name', 'id']
//       })


//     if (walletInfo) {
//       res.status(200).send({ message: 'Get wallet information', data: walletInfo })
//     }
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ success: false, message: 'Internal server error' });
//   }
// }

const GetwalletInfo = async (req, res) => {
  try {
    let { id } = req.params;
    id = (id ?? "").toString().trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid dealer id" });
    }
    const dealerId = new mongoose.Types.ObjectId(id);

    // optional filters
    const {
      page = 1,
      limit = 20,
      type,                    // "Credit" | "Debit" | "Pending"
      status,                  // "ACTIVE" | "PAID" | ...
      from,                    // ISO date string
      to,                      // ISO date string
      search                   // orderId partial
    } = req.query;

    const match = { dealer_id: dealerId };
    if (type) match.Type = type;
    if (status) match.order_status = status;

    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }
    if (search) {
      match.orderId = { $regex: String(search).trim(), $options: "i" };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const perPage = Math.max(1, Math.min(100, Number(limit)));

    // ---- single aggregation: summary + paginated transactions ----
    const [agg] = await Wallet.aggregate([
      { $match: match },
      { $sort: { _id: -1 } },
      {
        $facet: {
          // transactions list (paginated)
          transactions: [
            { $skip: skip },
            { $limit: perPage },
            {
              $lookup: {
                from: "dealers",               // collection name for ref:"dealer"
                localField: "dealer_id",
                foreignField: "_id",
                as: "dealer"
              }
            },
            { $unwind: { path: "$dealer", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                id: "$id",
                orderId: 1,
                amount: "$Amount",
                type: "$Type",
                note: "$Note",
                totalAfterTxn: "$Total",
                status: "$order_status",
                createdAt: 1,
                dealer: { name: "$dealer.name", id: "$dealer.id" }
              }
            }
          ],
          // counts for pagination
          meta: [{ $count: "total" }],
          // summary (totals)
          summary: [
            {
              $group: {
                _id: null,
                credits: {
                  $sum: { $cond: [{ $eq: ["$Type", "Credit"] }, "$Amount", 0] }
                },
                debits: {
                  $sum: { $cond: [{ $eq: ["$Type", "Debit"] }, "$Amount", 0] }
                },
                pending: {
                  $sum: { $cond: [{ $eq: ["$Type", "Pending"] }, "$Amount", 0] }
                },
                count: { $sum: 1 }
              }
            },
            {
              // currentBalance excludes Pending; if your "Total" is running balance,
              // you can also take the latest doc's Total instead.
              $addFields: {
                currentBalance: { $subtract: ["$credits", "$debits"] }
              }
            },
            { $project: { _id: 0 } }
          ]
        }
      }
    ]);

    const transactions = agg?.transactions ?? [];
    const totalDocs = agg?.meta?.[0]?.total ?? 0;
    const summary = agg?.summary?.[0] ?? {
      credits: 0, debits: 0, pending: 0, count: 0, currentBalance: 0
    };

    return res.status(200).json({
      success: true,
      message: "Wallet information",
      data: {
        summary,
        transactions,
        pagination: {
          page: Number(page),
          limit: perPage,
          total: totalDocs,
          pages: Math.ceil(totalDocs / perPage)
        }
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// const WalletAdd =async(req, res) => {

//   const data = jwt_decode(req.headers.token);
//   const user_id = data.user_id;
//   const user_type = data.user_type;
//   const type = data.type;
//   if (user_id == null || user_type != 1) {


//       var response = {
//         status: 200,
//         message: "not authorized",
//       };
//       return res.status(200).send(response);


//   }
//   const { Amount, Type, Note } = req.body;

// const dealer_id = req.params.id

// const dealer = await Dealer.findById(dealer_id)

// if (!dealer) {
//   var response = {
//     status: 200,
//     message: "dealer not found!",
//   };
//   return res.status(200).send(response);
// }
//   if (!Amount || !Type ) {
//       return res.status(200).json({ error: 'Amount and action are required' });
//   }

//   if (Type !== 'Credit' && Type !== 'Debit') {
//       return res.status(200).json({ error: 'Invalid action. Must be "Credit" or "Debit"' });
//   }

//   // Perform Credit or Debit operation
//   if (Type == 'Credit') {
//       dealer.wallet += Amount;
//       console.log(dealer.wallet,"yes")


//   } else {
//       // if (dealer.wallet < Amount) {
//       //     return res.status(200).json({ error: 'Insufficient balance' });
//       // }
//       dealer.wallet -= Amount;
//   }

//     const walletData = {
//       dealer_id: req.params.id,
//       Amount: req.body.Amount,
//       Type: req.body.Type,
//       Note: req.body.Note || '',
//       Total: dealer.wallet // Updated wallet balance
//     };

//    const create =  await Wallet.create(walletData);
//     console.log(create,"creATE")
//   await dealer.save();

//   // Return updated balance
//   res.status(200).json({ balance: dealer.wallet });
// }

// Payout related in cashfree method


async function calculateDealerAmount(dealer, orderAmount) {
  // Calculate percentage amount for dealer
  const percentageAmount = (dealer.commission / 100) * orderAmount;
  dealer.wallet += orderAmount - percentageAmount;
  await dealer.save();
}

const WalletAdd = async (req, res) => {
  try {
    const data = jwt_decode(req.headers.token);
    const { user_id, user_type } = data; // Extract user info from token
    const { Amount, Type, Note } = req.body;
    const dealer_id = req.params.id;

    // Validate required fields
    if (!Amount || !Type) {
      return res.status(200).json({
        status: 200,
        message: "Amount and Type are required"
      });
    }

    // Validate transaction type
    if (!['Credit', 'Debit'].includes(Type)) {
      return res.status(200).json({
        status: 200,
        message: 'Invalid transaction type. Use "Credit" or "Debit"'
      });
    }

    // Check if dealer exists
    const dealer = await Dealer.findById(dealer_id);
    if (!dealer) {
      return res.status(200).json({
        status: 200,
        message: "Dealer not found"
      });
    }

    // Authorization check
    if (user_type === 3) { // Subadmin
      const subAdmin = await Admin.findById(user_id);
      if (!subAdmin) {
        return res.status(200).json({
          status: 200,
          message: "Subadmin not found"
        });
      }

      const isAllowed = await checkPermission(user_id, "Dealers.wallet");
      if (!isAllowed) {
        return res.status(200).json({
          status: 200,
          message: "You do not have permission to perform this action"
        });
      }
    } else if (user_type === 2) { // Dealer
      if (dealer._id.toString() !== user_id) {
        return res.status(200).json({
          status: 200,
          message: "You can only manage your own wallet"
        });
      }
    } else if (user_type !== 1) { // Admin
      return res.status(200).json({
        status: 200,
        message: "Unauthorized access"
      });
    }

    // Handle Debit (withdrawal) validation
    if (Type === 'Debit' && dealer.wallet < Amount) {
      return res.status(200).json({
        status: 200,
        message: "Insufficient wallet balance"
      });
    }

    // Update wallet balance
    Type === 'Credit'
      ? dealer.wallet += Number(Amount)
      : dealer.wallet -= Number(Amount);

    // Create wallet transaction record
    const walletData = {
      dealer_id,
      Amount: Number(Amount),
      Type,
      Note: Note || `${Type} transaction`,
      Total: dealer.wallet,
      date: new Date().toISOString(),
      performed_by: user_id // Track who performed the transaction
    };

    await Wallet.create(walletData);
    await dealer.save();

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Transaction completed successfully",
      newBalance: dealer.wallet
    });

  } catch (error) {
    console.error("Wallet error:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal server error"
    });
  }
};


function prepareTransferRequest(dealerId, orderAmount) {
  const requestData = {
    transfer_from: 'VENDOR',
    transfer_type: 'ADJUSTMENT',
    transfer_amount: orderAmount,
    remark: 'Testing',
    tags: {
      size: 1,
      product: 'SHRT'
    }
  };

  const apiUrl = `https://sandbox.cashfree.com/pg/easy-split/vendors/${dealerId}/transfer`;

  const timestamp = Date.now();
  const tokenData = `${process.env.APP_ID}:${timestamp}:${process.env.SECRET_KEY}`;
  const token = crypto.createHmac('sha256', process.env.SECRET_KEY).update(tokenData).digest('base64');

  const headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'x-api-version': '2023-08-01',
    'X-Client-Id': process.env.APP_ID,
    'X-Client-Secret': process.env.SECRET_KEY,
    'X-Timestamp': timestamp
  };

  return { requestData, apiUrl, headers };
}

const tranfer = async (req, res) => {
  try {
    const { dealerId, orderAmount } = req.body;
    const { requestData, apiUrl, headers } = prepareTransferRequest(dealerId, orderAmount);
    return res.status(200).json({ success: true, requestData, apiUrl, headers, message: "ok" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

async function addAmount(req, res) {
  try {
    const dealerId = req.params.id;
    const { user_id, orderAmount, booking_id, tracking_id } = req.body;

    // Convert booking_id and tracking_id to MongoDB ObjectIDs
    // const bookingIdAsObjectId = mongoose.Types.ObjectId(booking_id);
    // const trackingIdAsObjectId = mongoose.Types.ObjectId(tracking_id);

    const dealer = await Dealer.findById(dealerId);

    if (!dealer) {
      return res.status(200).json({ success: false, message: 'Dealer not found' });
    }
    if (!customer) {
      return res.status(200).json({ success: false, message: 'Customer not found' });
    }

    // Update booking status
    await booking.findOneAndUpdate({ _id: booking_id }, { status: 'Payment' });

    // Update tracking status
    await tracking.findOneAndUpdate({ _id: tracking_id }, { status: 'Payment' });

    return res.status(200).json({ success: true, message: 'Amount added successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// async function getShopDetails(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_type = data.user_type;

//     if (user_type !== 4) {
//       return res.status(200).json({ success: false, message: "Unauthorized access!" });
//     }

//     const { dealer_id } = req.query;

//     if (!dealer_id) {
//       return res.status(200).json({ success: false, message: "Dealer ID is required!" });
//     }

//     // Fetch dealer details along with services
//     const dealer = await Vendor.findById(dealer_id)
//       .select("shopName shopImages shopDescription goDigital expertAdvice ourPromise latitude longitude pickupAndDropDescription pickupAndDrop address")
//       .populate("services");

//     if (!dealer) {
//       return res.status(200).json({ success: false, message: "Dealer not found!" });
//     }

//     const services = await servicess.find({ dealer_id: dealer_id });
//     // Fetch ratings for the dealer
//     const ratings = await Rating.find({ dealer_id: dealer_id });

//     // Calculate average rating
//     const totalRatings = ratings.length;
//     const sumRatings = ratings.reduce((acc, curr) => acc + curr.rating, 0);
//     const averageRating = totalRatings > 0 ? (sumRatings / totalRatings).toFixed(1) : "0.0";

//     return res.status(200).json({
//       success: true,
//       message: "Shop details retrieved successfully!",
//       data: {
//         ...dealer.toObject(),
//         services,
//         averageRating
//       }
//     });


//   } catch (error) {
//     console.error("Error in getShopDetails:", error);
//     return res.status(200).json({ success: false, message: "Internal server error!" });
//   }
// }

// async function getShopDetails(req, res) {
//   try {
//     const { id } = req.params;
//     const dealer_id = id.trim();

//     if (!dealer_id) {
//       return res.status(400).json({ success: false, message: "Dealer ID is required!" });
//     }

//     if (!mongoose.Types.ObjectId.isValid(dealer_id)) {
//       return res.status(400).json({ success: false, message: "Invalid Dealer ID format!" });
//     }

//     const dealer = await Vendor.findById(dealer_id)
//       .select("shopName shopImages shopDescription goDigital expertAdvice ourPromise latitude longitude pickupAndDropDescription pickupAndDrop address services")
//       .populate("services");

//     if (!dealer) {
//       return res.status(404).json({ success: false, message: "Dealer not found!" });
//     }

//     const ratings = await Rating.find({ dealer_id: dealer_id });
//     const totalRatings = ratings.length;
//     const sumRatings = ratings.reduce((acc, curr) => acc + curr.rating, 0);
//     const averageRating = totalRatings > 0 ? (sumRatings / totalRatings).toFixed(1) : "0.0";

//     return res.status(200).json({
//       success: true,
//       message: "Shop details retrieved successfully!",
//       data: {
//         ...dealer.toObject(),
//         averageRating
//       }
//     });

//   } catch (error) {
//     console.error("Error in getShopDetails:", error);
//     return res.status(500).json({ success: false, message: "Internal server error!" });
//   }
// }

// async function getShopDetails(req, res) {
//   try {
//     const { id } = req.params;
//     const dealer_id = id.trim();

//     if (!dealer_id) {
//       return res.status(400).json({ success: false, message: "Dealer ID is required!" });
//     }

//     if (!mongoose.Types.ObjectId.isValid(dealer_id)) {
//       return res.status(400).json({ success: false, message: "Invalid Dealer ID format!" });
//     }

//     // Fetch dealer with populated services
//     const dealer = await Vendor.findById(dealer_id)
//       .select("shopName shopImages shopDescription goDigital expertAdvice ourPromise latitude longitude pickupAndDropDescription pickupAndDrop address services")
//       .populate({
//         path: 'services',
//         match: { dealer_id: dealer_id } // Ensure we only populate services for this dealer
//       });

//     if (!dealer) {
//       return res.status(404).json({ success: false, message: "Dealer not found!" });
//     }

//     // Alternative service fetch if populate isn't working
//     const services = await Service.find({ dealer_id: dealer_id });

//     const ratings = await Rating.find({ dealer_id: dealer_id });
//     const totalRatings = ratings.length;
//     const sumRatings = ratings.reduce((acc, curr) => acc + curr.rating, 0);
//     const averageRating = totalRatings > 0 ? (sumRatings / totalRatings).toFixed(1) : "0.0";

//     return res.status(200).json({
//       success: true,
//       message: "Shop details retrieved successfully!",
//       data: {
//         ...dealer.toObject(),
//         services: services, // Use the separately fetched services if populate fails
//         averageRating
//       }
//     });

//   } catch (error) {
//     console.error("Error in getShopDetails:", error);
//     return res.status(500).json({ success: false, message: "Internal server error!" });
//   }
// }

// async function getShopDetails(req, res) {
//   try {
//     const { id } = req.params;
//     const { cc } = req.body; // Get CC from request body
//     const dealer_id = id.trim();

//     if (!dealer_id) {
//       return res.status(400).json({ success: false, message: "Dealer ID is required!" });
//     }

//     if (!mongoose.Types.ObjectId.isValid(dealer_id)) {
//       return res.status(400).json({ success: false, message: "Invalid Dealer ID format!" });
//     }

//     // Fetch dealer with populated services
//     const dealer = await Vendor.findById(dealer_id)
//       .select("shopName shopImages shopDescription goDigital expertAdvice ourPromise latitude longitude pickupAndDropDescription pickupAndDrop address services")
//       .populate({
//         path: 'services',
//         match: { dealer_id: dealer_id }
//       });

//     if (!dealer) {
//       return res.status(404).json({ success: false, message: "Dealer not found!" });
//     }

//     // Alternative service fetch if populate isn't working
//     let services = await Service.find({ dealer_id: dealer_id });

//     // Filter services to only include bikes with matching CC if cc is provided
//     if (cc) {
//       services = services.map(service => {
//         const filteredBikes = service.bikes.filter(bike => bike.cc === cc);
//         return {
//           ...service.toObject(),
//           bikes: filteredBikes
//         };
//       }).filter(service => service.bikes.length > 0); // Remove services with no matching bikes
//     }

//     const ratings = await Rating.find({ dealer_id: dealer_id });
//     const totalRatings = ratings.length;
//     const sumRatings = ratings.reduce((acc, curr) => acc + curr.rating, 0);
//     const averageRating = totalRatings > 0 ? (sumRatings / totalRatings).toFixed(1) : "0.0";

//     return res.status(200).json({
//       success: true,
//       message: "Shop details retrieved successfully!",
//       data: {
//         ...dealer.toObject(),
//         services: services,
//         averageRating
//       }
//     });

//   } catch (error) {
//     console.error("Error in getShopDetails:", error);
//     return res.status(500).json({ success: false, message: "Internal server error!" });
//   }
// }

async function getShopDetails(req, res) {
  try {
    const { id } = req.params;
    const { cc } = req.query; // Get CC from query parameter
    const dealer_id = id.trim();

    if (!dealer_id) {
      return res.status(400).json({ success: false, message: "Dealer ID is required!" });
    }

    if (!mongoose.Types.ObjectId.isValid(dealer_id)) {
      return res.status(400).json({ success: false, message: "Invalid Dealer ID format!" });
    }

    // Fetch dealer details
    const dealer = await Vendor.findById(dealer_id)
      .select("shopName shopImages shopDescription goDigital expertAdvice ourPromise latitude longitude pickupAndDropDescription pickupAndDrop address services");

    if (!dealer) {
      return res.status(404).json({ success: false, message: "Dealer not found!" });
    }

    // Fetch AdminServices that include this dealer in their dealers array
    let adminServices = await AdminService.find({ dealers: dealer_id })
      .populate({
        path: 'base_service_id',
        select: 'name description image'
      })
      .populate({
        path: 'companies',
        select: 'name'
      })
      .populate({
        path: 'bikes.model_id',
        select: 'name'
      })
      .populate({
        path: 'bikes.variant_id',
        select: 'name'
      });

    // Filter services to only include bikes with matching CC if cc is provided
    if (cc) {
      const ccNumber = parseInt(cc); // Convert query string to number
      adminServices = adminServices.map(service => {
        const filteredBikes = service.bikes.filter(bike => bike.cc === ccNumber);
        return {
          ...service.toObject(),
          bikes: filteredBikes
        };
      }).filter(service => service.bikes.length > 0); // Remove services with no matching bikes
    }

    // Fetch ratings for the dealer
    const ratings = await Rating.find({ dealer_id: dealer_id });
    const totalRatings = ratings.length;
    const sumRatings = ratings.reduce((acc, curr) => acc + curr.rating, 0);
    const averageRating = totalRatings > 0 ? (sumRatings / totalRatings).toFixed(1) : "0.0";

    return res.status(200).json({
      success: true,
      message: "Shop details retrieved successfully!",
      data: {
        ...dealer.toObject(),
        services: adminServices,
        averageRating
      }
    });

  } catch (error) {
    console.error("Error in getShopDetails:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
}

const addDealerShopDetails = async (req, res) => {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;

    let dealerId;

    if (user_type === 2) {
      // If dealer, get ID from token
      dealerId = user_id;
    } else if (user_type === 1) {
      // If admin, get ID from request body
      dealerId = req.body.dealer_id;
      if (!dealerId) {
        return res.status(200).send({ status: 200, message: "Dealer ID is required!" });
      }
    } else {
      return res.status(200).send({ status: 200, message: "Unauthorized access!" });
    }

    // Find the dealer
    const dealer = await Dealer.findById(dealerId);
    if (!dealer) {
      return res.status(200).send({ status: 200, message: "Dealer not found!" });
    }

    // Build update object with allowed fields from body
    let updateData = {};

    const allowedFields = [
      "shopName",
      "shopDescription",
      "shopPinCode",
      "shopCity",
      "shopState",
      "shopPhone",
      "businessEmail"
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (req.files?.shopImages) {
      const newImages = req.files.shopImages.map(file => file.location);
      updateData.shopImages = dealer.shopImages
        ? [...dealer.shopImages, ...newImages]
        : newImages;
    }

    // Set shop detail flag
    updateData.isShopDetailsAdded = true;

    // Save update
    const updatedDealer = await Dealer.findByIdAndUpdate(
      dealerId,
      { $set: updateData },
      { new: true }
    );

    return res.status(200).send({
      status: 200,
      success: true,
      message: "Shop details updated successfully",
      shopAdded: true,
      data: updatedDealer
    });

  } catch (error) {
    console.error("Error updating shop details:", error);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
      shopAdded: false,
    });
  }
};

const addDealerDocuments = async (req, res) => {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;

    let dealerId;

    if (user_type === 2) {
      // If dealer, get ID from token
      dealerId = user_id;
    } else if (user_type === 1) {
      // If admin, get ID from request body
      dealerId = req.body.dealer_id;
      if (!dealerId) {
        return res.status(200).send({ status: 200, message: "Dealer ID is required!" });
      }
    } else {
      return res.status(200).send({ status: 200, message: "Unauthorized access!" });
    }

    // Find the dealer
    const dealer = await Dealer.findById(dealerId);
    if (!dealer) {
      return res.status(200).send({ status: 200, message: "Dealer not found!" });
    }

    // ✅ Debugging: Check if files are received
    console.log("Uploaded Files:", req.files);

    // Prepare update object
    let updateData = {};

    // ✅ Handle Aadhar & PAN Card Image Uploads
    if (req.files?.adharCardFront) updateData.adharCardFront = req.files.adharCardFront[0].location;
    if (req.files?.adharCardBack) updateData.adharCardBack = req.files.adharCardBack[0].location;
    if (req.files?.panCardFront) updateData.panCardFront = req.files.panCardFront[0].location;
    if (req.files?.panCardBack) updateData.panCardBack = req.files.panCardBack[0].location;

    // ✅ Set confirmation flag
    updateData.isDocumentsAdded = true;

    // ✅ Update dealer document
    const updatedDealer = await Dealer.findByIdAndUpdate(dealerId, { $set: updateData }, { new: true });

    console.log("Updated Dealer Documents:", updatedDealer);

    return res.status(200).send({
      status: 200,
      success: true,
      message: "Dealer documents uploaded successfully",
      documentsAdded: true,
    });

  } catch (error) {
    console.error("Error uploading dealer documents:", error);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
      documentsAdded: false,
    });
  }
};

const getPendingWallets = async (req, res) => {
  try {
    const pendingWallets = await Wallet.find({
      order_status: 'PENDING',
      Type: { $nin: ['Credit', 'Pending'] }
    })
      .sort({ createdAt: -1 })
      .populate('dealer_id');

    return res.status(200).json({
      status: true,
      message: "Filtered pending wallet entries retrieved successfully",
      data: pendingWallets
    });
  } catch (error) {
    console.error("Error fetching pending wallets:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
};

const updateWalletStatus = async (req, res) => {
  try {
    const { wallet_id } = req.params;
    const { new_status } = req.body;

    if (!wallet_id || !new_status) {
      return res.status(400).json({ status: false, message: "wallet_id and new_status are required" });
    }

    const updatedWallet = await Wallet.findByIdAndUpdate(
      wallet_id,
      { $set: { order_status: new_status, updatedAt: new Date() } },
      { new: true }
    );

    if (!updatedWallet) {
      return res.status(404).json({ status: false, message: "Wallet entry not found" });
    }

    return res.status(200).json({
      status: true,
      message: "Wallet status updated successfully",
      data: updatedWallet
    });

  } catch (error) {
    console.error("Error updating wallet status:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
};

const getAllDealersWithDocFalse = async (req, res) => {
  try {
    const data = jwt_decode(req.headers.token);
    const user_type = data.user_type;
    if (user_type === 1) {
      const allDealers = await Dealer.find({ isDoc: false });
      if (!allDealers) {
        return res.status(404).json({
          success: false,
          message: "No Dealer found in the collection."
        })
      }
      return res.status(200).json({
        succcess: true,
        message: "Dealers list fetched successfully",
        data: allDealers
      })
    }
    else {
      return res.status(403).json({
        success: false,
        message: "Unauthorised access!"
      })
    }
  }
  catch (err) {
    console.error("Error fetching Dealers details:", err);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
}

const getAllDealersWithVerifyFalse = async (req, res) => {
  try {
    const allDealers = await Dealer.find({ isVerify: false });

    if (!allDealers || allDealers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No Dealer found in the collection."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Dealers list fetched successfully",
      data: allDealers
    });

  } catch (err) {
    console.error("Error fetching Dealers details:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

const updateDealerDocStatus = async (req, res) => {
  try {
    const data = jwt_decode(req.headers.token);
    const user_type = data.user_type;
    const { id } = req.body;
    if (user_type === 1) {
      const dealerDetails = await Dealer.findByIdAndUpdate(id, { isDoc: true }, { new: true, runValidators: true });
      if (!dealerDetails) {
        return res.status(404).json({
          success: false,
          message: "No Dealer found in the collection."
        })
      }
      return res.status(200).json({
        succcess: true,
        message: "Dealer Doc status updated successfully",
        data: dealerDetails
      })
    }
    else {
      return res.status(403).json({
        success: false,
        message: "Unauthorised access!"
      })
    }
  }
  catch (err) {
    console.error("Error updating dealers details:", err);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
}

const updateDealerVerfication = async (req, res) => {
  try {
    const data = jwt_decode(req.headers.token);
    const user_type = data.user_type;
    const { id } = req.body;
    if (user_type === 1) {
      const dealerDetails = await Dealer.findByIdAndUpdate(id, { isVerify: true }, { new: true, runValidators: true });
      if (!dealerDetails) {
        return res.status(404).json({
          success: false,
          message: "No Dealer found in the collection."
        })
      }
      return res.status(200).json({
        succcess: true,
        message: "Dealer Doc status updated successfully",
        data: dealerDetails
      })
    }
    else {
      return res.status(403).json({
        success: false,
        message: "Unauthorised access!"
      })
    }
  }
  catch (err) {
    console.error("Error updating dealers details:", err);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
}

// By prashant 
// async function dealerList(req, res) {
//   try {
//     const dealerResponse = await Vendor.find({});

//     if (dealerResponse.length > 0) {
//       return res.status(200).send({
//         status: 200,
//         message: "Success",
//         data: dealerResponse,
//       });
//     } else {
//       return res.status(200).send({
//         status: 200,
//         message: "No Dealers Found",
//         data: [],
//       });
//     }
//   } catch (error) {
//     console.error("Dealer list error:", error);
//     return res.status(500).send({
//       status: 500,
//       message: "Operation was not successful",
//     });
//   }
// }

async function dealerList(req, res) {
  try {
    const dealerResponse = await Vendor.find({
      "status.adminApproved": true,
      "status.isActive": true,
      "status.isVerified": true
    });

    if (dealerResponse.length > 0) {
      return res.status(200).send({
        status: 200,
        message: "Success",
        data: dealerResponse,
      });
    } else {
      return res.status(200).send({
        status: 200,
        message: "No Dealers Found",
        data: [],
      });
    }
  } catch (error) {
    console.error("Dealer list error:", error);
    return res.status(500).send({
      status: 500,
      message: "Operation was not successful",
    });
  }
}

async function deleteDealer(req, res) {
  try {
    const { dealer_id } = req.body;
    console.log("Dealer id", req.body);

    if (!dealer_id) {
      return res.status(400).json({
        status: 400,
        message: "dealer_id is required"
      });
    }

    const dealerRes = await Vendor.findOne({ _id: dealer_id });
    if (!dealerRes) {
      return res.status(404).json({
        status: 404,
        message: "No Dealer Found"
      });
    }

    console.log("Dealer res:-", dealerRes);

    await Vendor.findByIdAndDelete({ _id: dealer_id });

    return res.status(200).json({
      status: 200,
      message: "Dealer deleted successfully"
    });

  } catch (error) {
    console.error("Delete dealer error:", error);
    return res.status(500).json({
      status: 500,
      message: "Operation was not successful",
      error: error.message
    });
  }
}

async function singledealer(req, res) {
  try {
    const dealerResposnse = await Vendor.findById(req.params.id)

    if (dealerResposnse) {
      return res.status(200).send({
        status: true,
        message: "success",
        data: dealerResposnse,
      });
    } else {
      return res.status(404).send({
        status: false,
        message: "No Dealer Found",
      });
    }
  } catch (error) {
    console.error("error", error);
    return res.status(500).send({
      status: false,
      message: "Operation was not successful",
    });
  }
}

async function setDealerOnline(req, res) {
  try {
    const { dealerId } = req.params;
    const { active } = req.body;

    if (!mongoose.Types.ObjectId.isValid(dealerId)) {
      return res.status(400).json({ success: false, message: "Invalid dealerId" });
    }
    if (typeof active !== "boolean") {
      return res.status(400).json({ success: false, message: "active must be boolean" });
    }

    const now = new Date();
    const update = active
      ? { online: true, activeSince: now, lastSeen: now }
      : { online: false, activeSince: null, lastSeen: now };

    const dealer = await Vendor.findByIdAndUpdate(
      dealerId,
      { $set: update },
      { new: true, lean: true }
    );

    if (!dealer) return res.status(404).json({ success: false, message: "Dealer not found" });

    return res.status(200).json({
      success: true,
      message: `Dealer is now ${dealer.online ? "Active" : "Inactive"}`,
      data: dealer,
    });
  } catch (err) {
    console.error("setDealerOnline error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

async function getActiveDealers(req, res) {
  try {
    const {
      city,
      state,
      page = 1,
      limit = 20,
      q
    } = req.query;

    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const sz = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = { online: true }; // 🔑 active = online
    if (city) filter.city = city;
    if (state) filter.state = state;

    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), "i");
      filter.$or = [
        { shopName: rx },
        { ownerName: rx },
        { phone: rx },
        { email: rx },
      ];
    }

    const [data, total] = await Promise.all([
      Vendor.find(filter)
        .sort({ activeSince: -1, updatedAt: -1 })
        .skip((pg - 1) * sz)
        .limit(sz)
        .select(
          "shopName ownerName phone email city state latitude longitude online activeSince lastSeen services"
        )
        .lean(),
      Vendor.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Active dealers fetched successfully",
      page: pg,
      limit: sz,
      total,
      totalPages: Math.max(1, Math.ceil(total / sz)),
      data,
    });
  } catch (err) {
    console.error("getActiveDealers error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

module.exports = {
  getActiveDealers,
  editDealer,
  dealerList,
  deleteDealer,
  singledealer,
  dealerWithInRange,
  editDealerStatus,
  GetwalletInfo,
  WalletAdd,
  addAmount,
  tranfer,
  dealerWithInRange2,
  getShopDetails,
  addDealerShopDetails,
  addDealerDocuments,
  getWallet,
  getPendingWallets,
  updateWalletStatus,
  getAllDealersWithDocFalse,
  getAllDealersWithVerifyFalse,
  updateDealerDocStatus,
  updateDealerVerfication,
  setDealerOnline
};
