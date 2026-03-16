var validation = require("../helper/validation");
require("dotenv").config();
const mongoose = require("mongoose");
var moment = require("moment");
const customers = require("../models/customer_model");
const Vendor = require("../models/dealerModel");
const { is } = require("express/lib/request");
const jwt_decode = require("jwt-decode");
const otpAuth = require("../helper/otpAuth");
const UserBike = require("../models/userBikeModel");

// async function customersignup(req, res) {

//   try {

//     if (req.body.email != "" && req.body.passwords != "") {
//       var emailCheck = await customers.findOne({ email: req.body.email });

//       if(emailCheck){
//             res.status(401).json({success:false, message:"Customer Already Exists"});
//             return;
//       }

//       if (!emailCheck) {
//       if(req.file){
//         const data = {
//           first_name: req.body.first_name,
//           last_name: req.body.last_name,
//           email: req.body.email,
//           password: validation.hashPassword(req.body.password),
//           phone: req.body.phone,
//           image: req.file.filename,
//           state: req.body.state,
//           city: req.body.city,
//           address: req.body.address,
//           device_token: req.body.device_token,
//         };
//         const customerResposnse = await customers.create(data);
//         if (customerResposnse) {
//           var response = {
//             status: 200,
//             message: "Customer Registration successfull",
//             // data: customerResposnse,
//             image_base_url: process.env.BASE_URL,
//           };
//           return res.status(200).send(response);
//         } else {
//           var response = {
//             status: 201,
//             message: "Registration failed",
//           };
//           return res.status(201).send(response);
//         }
//       } else {
//         // var response = {
//         //   status: 201,
//         //   message: "please upload profile image",
//         // };
//         // return res.status(201).send(response);

//         const data = {
//           first_name: req.body.first_name,
//           last_name: req.body.last_name,
//           email: req.body.email,
//           password: validation.hashPassword(req.body.password),
//           phone: req.body.phone,
//           state: req.body.state,
//           city: req.body.city,
//           address: req.body.address,
//           device_token: req.body.device_token,
//         };
//         const customerResposnse = await customers.create(data);
//         if (customerResposnse) {
//           var response = {
//             status: 200,
//             message: "Customer Registration successfull",
//             // data: customerResposnse,
//             image_base_url: process.env.BASE_URL,
//           };
//           return res.status(200).send(response);
//         } else {
//           var response = {
//             status: 201,
//             message: "Registration failed",
//           };
//           return res.status(201).send(response);
//         }
//       }
//       } else {
//         var response = {
//           status: 201,
//           message: "Email already exist",
//         };
//         return res.status(201).send(response);
//       }
//     } else {
//       var response = {
//         status: 201,
//         message: "email and password not be empty value !",
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

const updateUserBike = async (req, res) => {
  try {
    const { id } = req.params; // Get bike ID from URL params
    const updateData = req.body; // Get update data from request body

    // Check if the bike exists
    const existingBike = await UserBike.findById(id);
    if (!existingBike) {
      return res.status(404).json({ message: "Bike not found" });
    }

    // Update the bike details
    const updatedBike = await UserBike.findByIdAndUpdate(id, updateData, {
      new: true, // Return the updated document
      runValidators: true, // Ensure validation rules are applied
    });

    res.status(200).json({
      message: "Bike details updated successfully",
      data: updatedBike,
    });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

async function addProfile(req, res) {
  try {
    const { first_name, last_name, state, city, address, pincode } = req.body;

    // Extract user_id from request (set by authentication middleware)
    const user_id = req.user_id;
    console.log(user_id, "userid");
    if (!user_id) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    let user = await customers.findOne({ _id: user_id });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Update user profile fields
    user.first_name = first_name;
    user.last_name = last_name;
    user.state = state;
    user.city = city;
    user.address = address;
    user.pincode = pincode;
    user.isProfile = true;

    if (req.file) {
      user.image = req.file.location
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile added successfully.",
      profile: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

const deleteMyBike = async (req, res) => {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const { bike_id } = req.params; // Get bike ID from URL params

    console.log("🔹 Received User ID:", user_id);
    console.log("🔹 Received Bike ID:", bike_id);

    if (!user_id) {
      return res.status(200).json({
        status: 200,
        message: "Unauthorized access!",
        data: [],
      });
    }

    // Find the bike and ensure it belongs to the user
    const bike = await UserBike.findOne({ _id: bike_id });

    console.log("🔹 Found Bike:", bike); // Debugging log

    if (!bike) {
      return res.status(200).json({
        status: 200,
        message: "Bike not found!",
        data: [],
      });
    }

    console.log("🔹 Bike Owner ID:", bike.user_id.toString());
    console.log(
      "🔹 Checking if User ID matches:",
      user_id === bike.user_id.toString(),
    );

    if (bike.user_id.toString() !== user_id) {
      return res.status(200).json({
        status: 200,
        message: "Bike does not belong to the user!",
        data: [],
      });
    }

    // Delete the bike
    await UserBike.findByIdAndDelete(bike_id);

    return res.status(200).json({
      status: 200,
      message: "Bike deleted successfully",
      data: [],
    });
  } catch (error) {
    console.error("❌ Error deleting user bike:", error);

    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      data: [],
    });
  }
};

// async function getcustomer(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     let user_id;

//     if (data.user_type === 1) {
//       user_id = req.query.user_id; // Admin ke case mein user_id query params se lega
//     } else if (data.user_type === 4) {
//       user_id = data.user_id; // User ke case mein token se lega
//     } else {
//       return res.status(403).json({ success: false, message: "Unauthorized access" });
//     }

//     const customer = await customers.findById(user_id);

//     if (!customer) {
//       return res.status(404).json({ success: false, message: "No Customer Account Found" });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "success",
//       data: customer,
//       image_base_url: process.env.BASE_URL,
//     });

//   } catch (error) {
//     console.error("Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Operation was not successful",
//     });
//   }
// }

async function getcustomer(req, res) {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      return res
        .status(400)
        .json({ success: false, message: "user_id is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(user_id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user_id" });
    }

    const customer = await Vendor.findById(user_id);
    // const customer = await customers.findById(user_id);

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "No Customer Account Found" });
    }
    console.log("Customer", customer);
    return res.status(200).json({
      success: true,
      message: "success",
      data: customer,
      image_base_url: process.env.BASE_URL,
    });
  } catch (error) {
    console.error("Error in getcustomer:", error);
    return res.status(500).json({
      success: false,
      message: "Operation was not successful",
    });
  }
}

async function getcustomersData(req, res) {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      return res
        .status(400)
        .json({ success: false, message: "user_id is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(user_id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user_id" });
    }

    // const customer = await Vendor.findById(user_id);
    const customer = await customers.findById(user_id);

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "No Customer Account Found" });
    }
    console.log("Customer", customer);
    return res.status(200).json({
      success: true,
      message: "success",
      data: customer,
      image_base_url: process.env.BASE_URL,
    });
  } catch (error) {
    console.error("Error in getcustomer:", error);
    return res.status(500).json({
      success: false,
      message: "Operation was not successful",
    });
  }
}

async function deletecustomer(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || user_type != 1) {
      var response = {
        status: 401,
        message: "admin is un-authorised !",
      };
      return res.status(401).send(response);
    }
    const { customer_id } = req.body;
    //console.log('customer_id: ', customer_id);
    const customerRes = await customers.findOne({ _id: customer_id });
    if (customerRes) {
      customers.findByIdAndDelete(
        { _id: customer_id },
        async function (err, docs) {
          if (err) {
            var response = {
              status: 201,
              message: "customer delete failed",
            };
            return res.status(201).send(response);
          } else {
            var response = {
              status: 200,
              message: "customer deleted successfully",
            };
            return res.status(200).send(response);
          }
        },
      );
    } else {
      var response = {
        status: 201,
        message: "customer not Available",
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

async function editcustomer(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || (user_type != 1 && user_type != 4)) {
      var response = {
        status: 401,
        message: "admin is un-authorised !",
      };
      return res.status(401).send(response);
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      state,
      city,
      address,
      pincode,
    } = req.body;

    const customerResp = await customers.findOne({ _id: req.params.id });
    // console.log("customerResp : ", customerResp);
    if (customerResp) {
      const data = {
        first_name: first_name,
        last_name: last_name,
        email: email,
        phone: phone,
        state: state,
        city: city,
        address: address,
        pincode: pincode,
        isProfile: true,
      };
      customers.findByIdAndUpdate(
        { _id: req.params.id },
        { $set: data },
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
              message: "customer updated successfully",
              data: docs,
              image_base_url: docs.image?.startsWith("http") ? "" : process.env.BASE_URL,
            };
            return res.status(200).send(response);
          }
        },
      );
    } else {
      response = {
        status: 201,
        message: "customer not available",
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

async function changeImage(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;

    if (!user_id || (user_type !== 1 && user_type !== 4)) {
      return res
        .status(200)
        .json({ success: false, message: "Unauthorized access!" });
    }

    const customer = await customers.findById(user_id);
    if (!customer) {
      return res
        .status(200)
        .json({ success: false, message: "No Customer Account Found" });
    }

    if (!req.file) {
      return res
        .status(200)
        .json({ success: false, message: "Please upload an image" });
    }

    // ✅ Update the image and return full URL
    customer.image = req.file.location

    await customer.save()

    const imageUrl = customer.image

    return res.status(200).json({
      success: true,
      message: "Profile Image updated successfully",
      image_name: customer.image,
      full_image_url: imageUrl,
    });
  } catch (error) {
    console.error("Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Operation was not successful" });
  }
}

const getMyBikes = async (req, res) => {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;

    console.log(`[getMyBikes] Fetching bikes for user ID: ${user_id}`);

    if (!user_id) {
      console.warn(
        `[getMyBikes] Unauthorized access attempt: No user ID in token`,
      );
      return res.status(200).json({
        status: 200,
        message: "Unauthorized access!",
        data: [],
      });
    }

    // Fetch user bikes
    const userBikes = await UserBike.find({ user_id });
    console.log(
      `[getMyBikes] Found ${userBikes.length} bikes for user ID: ${user_id}`,
    );

    res.status(200).json({
      status: 200,
      message:
        userBikes.length > 0
          ? "Bikes retrieved successfully"
          : "No bikes found",
      data: userBikes,
    });
  } catch (error) {
    console.error("Error fetching user bikes:", error);
    res.status(200).json({
      status: 200,
      message: "Internal Server Error",
      data: [],
    });
  }
};

const addUserBike = async (req, res) => {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;

    console.log(`[addUserBike] Adding new bike for user ID: ${user_id}`);
    console.log(`[addUserBike] Request body:`, req.body);

    if (!user_id) {
      console.warn(
        `[addUserBike] Unauthorized access attempt: No user ID in token`,
      );
      return res.status(200).json({
        status: 200,
        message: "Unauthorized access!",
        data: [],
      });
    }

    const { name, model, bike_cc, plate_number, variant_id } = req.body;

    // Check if all required fields are provided
    if (!name || !model || !bike_cc || !plate_number) {
      console.warn(
        `[addUserBike] Validation failed: Missing required fields for user ID: ${user_id}`,
      );
      return res.status(200).json({
        status: 200,
        message:
          "All fields (name, model, bike_cc, plate_number) are required!",
        data: [],
      });
    }

    // Check if the plate number already exists
    const existingBike = await UserBike.findOne({ plate_number });

    if (existingBike) {
      console.warn(`[addUserBike] Plate number ${plate_number} already exists`);
      return res.status(200).json({
        status: 200,
        message: "A bike with this plate number already exists!",
        data: [],
      });
    }

    // Create a new bike entry
    const newBike = new UserBike({
      user_id,
      name,
      model,
      bike_cc,
      plate_number,
      variant_id,
    });

    await newBike.save();
    console.log(
      `[addUserBike] Successfully saved new bike for user ID: ${user_id}. Bike ID: ${newBike._id}`,
    );

    res.status(200).json({
      status: 200,
      message: "Bike added successfully",
      data: newBike,
    });
  } catch (error) {
    console.error("Error adding user bike:", error);

    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      data: [],
    });
  }
};

// By prashant
async function customerlist(req, res) {
  try {
    const customerResponse = await customers.find();

    const response = {
      status: 200,
      message: "success",
      data: customerResponse,
      image_base_url: process.env.BASE_URL, // Keep for list as individual items might vary
    };
    return res.status(200).send(response);
  } catch (error) {
    console.log("error", error);
    const response = {
      status: 500,
      message: "Operation was not successful",
    };
    return res.status(500).send(response);
  }
}

async function deletecustomer(req, res) {
  try {
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).send({
        status: 400,
        message: "customer_id is required",
      });
    }

    const customerRes = await customers.findOne({ _id: customer_id });

    if (!customerRes) {
      return res.status(404).send({
        status: 404,
        message: "Customer not found",
      });
    }

    await customers.findByIdAndDelete(customer_id);

    return res.status(200).send({
      status: 200,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.log("error", error);
    return res.status(500).send({
      status: 500,
      message: "Operation was not successful",
    });
  }
}

module.exports = {
  addProfile,
  customerlist,
  deletecustomer,
  editcustomer,
  getcustomer,
  changeImage,
  updateUserBike,
  getMyBikes,
  deleteMyBike,
  addUserBike,
  getcustomersData,
};
