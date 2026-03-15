// var validation = require('../helper/validation');
// const otpAuth = require("../helper/otpAuth");
// const Dealer = require('../models/Dealer');
// const Vendor = require('../models/dealerModel');
// const Admin = require('../models/admin_model');
// const jwt = require('jsonwebtoken');
// const mongoose = require('mongoose');

// async function sendOtp(req, res) {
//   try {
//     const { phone } = req.body;

//     if (phone != '' || phone === null) {
//       var userResm = await Dealer.findOne({ phone });

//       if (userResm) {
//         const data = await otpAuth.otp(phone)

//         Dealer.findByIdAndUpdate({ _id: userResm._id },
//           { otp: data.otp },
//           { new: true },
//           async function (err, docs) {
//             if (err) {
//               var response = {
//                 status: 201,
//                 message: err,
//               };
//               return res.status(201).send(response);
//             }
//             else {
//               var response = {
//                 status: 200,
//                 message: 'OTP send successfully',
//               };
//               res.status(200)
//                 .json(response);
//             }
//           });
//       } else {
//         var response = {
//           status: 201,
//           message: 'Dealer not exist',
//         };
//         return res.status(201).send(response);
//       }

//     } else {
//       var response = {
//         status: 201,
//         message: 'Phone No can not be empty value!',
//       };
//       return res.status(201).send(response);
//     }
//   } catch (error) {
//     console.log("error", error);
//     response = {
//       status: 201,
//       message: 'Operation was not successful',
//     };
//     return res.status(201).send(response);
//   }
// }

// // async function usersignin(req, res) {
// //   try {
// //     const { phone, ftoken, device_token } = req.body;

// //     if (!phone) {
// //       return res.status(400).json({
// //         success: false,
// //         message: 'Phone number is required!'
// //       });
// //     }

// //     let dealer = await Vendor.findOne({ phone, isActive: true, isBlock: false });

// //     const otpData = await otpAuth.otp(phone);
// //     const otp = otpData.otp;

// //     if (!dealer) {
// //       dealer = new Vendor({
// //         phone,
// //         otp,
// //         ftoken,
// //         device_token,
// //         isActive: true,
// //         isVerify: false,
// //         isProfile: false,
// //         isDoc: false,
// //       });
// //     } else {
// //       dealer.otp = otp;
// //       dealer.ftoken = ftoken;
// //       dealer.device_token = device_token;
// //       dealer.isActive = true;
// //     }

// //     await dealer.save();

// //     res.status(dealer.isNew ? 201 : 200).json({
// //       success: true,
// //       message: 'OTP sent to your mobile.',
// //       data: {
// //         phone: dealer.phone,
// //         isVerify: dealer.isVerify,
// //         isDoc: dealer.isDoc,
// //         isProfile: dealer.isProfile
// //       }
// //     });

// //   } catch (error) {
// //     console.error('Login error:', error);
// //     res.status(500).json({
// //       success: false,
// //       message: 'Internal server error',
// //       error: process.env.NODE_ENV === 'development' ? error.message : undefined
// //     });
// //   }
// // }

// async function usersignin(req, res) {
//   try {
//     const { phone, ftoken, device_token } = req.body;

//     if (!phone) {
//       return res.status(400).json({
//         success: false,
//         message: "Phone number is required!"
//       });
//     }

//     const otp = "9999";
//     const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

//     let dealer = await Vendor.findOne({ phone });

//     if (!dealer) {
//       // new dealer creation
//       dealer = new Vendor({
//         phone,
//         otp,
//         otpExpiry,
//         ftoken,
//         device_token,
//         isActive: true,
//         isVerify: false,
//         isProfile: false,
//         isDoc: false
//       });
//     } else {
//       // update existing dealer
//       dealer.otp = otp;
//       dealer.otpExpiry = otpExpiry;
//       dealer.ftoken = ftoken || dealer.ftoken;
//       dealer.device_token = device_token || dealer.device_token;
//       dealer.isActive = true;
//     }

//     await dealer.save();

//     return res.status(dealer.isNew ? 201 : 200).json({
//       success: true,
//       message: "OTP sent to your mobile.",
//       data: {
//         phone: dealer.phone,
//         isVerify: dealer.isVerify,
//         isDoc: dealer.isDoc,
//         isProfile: dealer.isProfile
//       }
//     });
//   } catch (error) {
//     console.error("Login error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       ...(process.env.NODE_ENV === "development" ? { error: error.message } : {})
//     });
//   }
// }

// async function verifyOTP(req, res) {
//   try {
//     const { otp, phone } = req.body;

//     if (!phone) {
//       return res.status(400).json({
//         success: false,
//         message: 'Phone number is required'
//       });
//     }

//     const dealer = await Vendor.findOne({ phone });

//     if (otp !== '9999') {
//       return res.status(401).json({
//         success: false,
//         message: 'Incorrect OTP'
//       });
//     }

//     if (!dealer) {
//       const newDealer = new Vendor({
//         phone,
//         email: `user_${Date.now()}_${Math.floor(Math.random() * 10000)}@autogen.dr`,
//         isVerify: false,
//         isProfile: false,
//         isDoc: false,
//         isActive: true,
//       });

//       await newDealer.save();

//       const token = validation.generateUserToken(newDealer._id, 'dealer', '2h');

//       return res.status(201).json({
//         success: true,
//         message: 'New user created successfully',
//         data: {
//           dealer_id: newDealer._id,
//           token,
//           isNewUser: true,
//           status: {
//             isVerify: newDealer.isVerify,
//             isDoc: newDealer.isDoc,
//             isProfile: newDealer.isProfile
//           }
//         }
//       });
//     }

//     const token = validation.generateUserToken(dealer._id, 'dealer', '2h');
//     const isNewUser = !dealer.isProfile || !dealer.isDoc || !dealer.isVerify;

//     return res.status(200).json({
//       success: true,
//       message: isNewUser ? 'Signup in progress' : 'Login successful',
//       data: {
//         dealer_id: dealer._id,
//         token,
//         isNewUser,
//         status: {
//           isVerify: dealer.isVerify,
//           isDoc: dealer.isDoc,
//           isProfile: dealer.isProfile
//         }
//       }
//     });

//   } catch (error) {
//     console.error('OTP verification error:', error);

//     if (error.code === 11000) {
//       if (error.keyPattern.phone) {
//         return res.status(409).json({
//           success: false,
//           message: 'Phone number already registered'
//         });
//       }
//       return res.status(409).json({
//         success: false,
//         message: 'Email already exists'
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//       ...(process.env.NODE_ENV === 'development' && { error: error.message })
//     });
//   }
// }

// async function changePassword(req, res) {
//   try {
//     const { phone, new_password, confirm_password } = req.body;

//     const dealers = await Dealer.findOne({ phone }).select("+password");

//     if (!dealers) {
//       var response = {
//         status: 201,
//         message: 'Mobile no not exist',
//       };
//       return res.status(201).send(response);
//     }

//     if (validation.comparePassword(dealers.password, new_password)) {
//       var response = {
//         status: 201,
//         message: 'New Password can not Same as Old Password',
//       };
//       return res.status(201).send(response);
//     }

//     if (new_password != confirm_password) {
//       var response = {
//         status: 201,
//         message: 'Password Not Matched',
//       };
//       return res.status(201).send(response);
//     }

//     const datas = {
//       password: validation.hashPassword(new_password)
//     }

//     var where = { _id: dealers._id };

//     Dealer.findByIdAndUpdate(where,
//       { $set: datas },
//       { new: true },
//       async function (err, docs) {
//         if (err) {
//           var response = {
//             status: 201,
//             message: err,
//           };
//           return res.status(201).send(response);
//         }
//         else {
//           var response = {
//             status: 200,
//             message: 'Dealer Password Updated Successfully',
//             // data: docs,
//           };
//           return res.status(200).send(response);
//         }
//       });

//   } catch (error) {
//     console.log("error", error);
//     response = {
//       status: 201,
//       message: "Operation was not successful",
//     };
//     return res.status(201).send(response);
//   }
// }

// async function logout(req, res) {
//   try {
//     // res.clearCookie('refreshToken')
//     res
//       .status(200)
//       .cookie("token", null, { expires: new Date(Date.now()), httpOnly: true })
//       .cookie("accessToken", null, { expires: new Date(Date.now()), httpOnly: true })
//       .cookie("refreshToken", null, { expires: new Date(Date.now()), httpOnly: true })
//       .cookie("authSession", null, { expires: new Date(Date.now()), httpOnly: true })
//       .cookie("refreshTokenID", null, { expires: new Date(Date.now()), httpOnly: true })
//       .json({
//         success: true,
//         message: "Logged out",
//       });
//   } catch (error) {
//     console.log("error", error);
//     response = {
//       status: 201,
//       message: "Operation was not successful",
//     };
//     return res.status(201).send(response);
//   }
// }

// async function resendOtp(req, res) {
//   try {
//     const { phone } = req.body;
//     if (!phone) {
//       return res.status(400).json({ success: false, message: "Phone number is required" });
//     }

//     const user = await Dealer.findOne({ phone });
//     if (!user) {
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     const otpData = await otpAuth.otp(phone);
//     user.otp = otpData.otp;
//     await user.save();

//     res.status(200).json({ success: true, message: "OTP sent successfully" });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// }

// async function getProgress(req, res) {
//   try {
//     // 1. Extract and validate token format
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return res.status(401).json({
//         success: false,
//         message: "Authorization header with Bearer token required"
//       });
//     }

//     const token = authHeader.split(' ')[1];

//     // 2. Verify token with same secret used in generation
//     const decoded = jwt.verify(token, process.env.JWT_SECRET, {
//       algorithms: ['HS256'],
//       ignoreExpiration: false
//     });

//     console.log("Decoded Token:", decoded);

//     // 3. Check for required fields in payload
//     if (!decoded.user_id) {
//       return res.status(401).json({
//         success: false,
//         message: "Token missing required user_id field"
//       });
//     }

//     // 4. Find vendor (now using user_id instead of _id)
//     const vendor = await Vendor.findById(decoded.user_id)
//     // .select("formProgress completionTimestamps isActive adminApproved");
//     // .select("formProgress completionTimestamps");

//     console.log("Vendor detaials", vendor)

//     if (!vendor) {
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found"
//       });
//     }


//     // 5. Return progress data
//     res.status(200).json({
//       success: true,
//       currentStep: vendor.formProgress.currentStep,
//       nextStep: determineNextStep(vendor.formProgress.completedSteps),
//       completedSteps: Object.fromEntries(vendor.formProgress.completedSteps),
//       timestamps: vendor.completionTimestamps,
//       status: {
//         adminApproved: vendor.status.adminApproved || false,
//         isActive: vendor.status.isActive || false,
//         isVerified: vendor.status.isVerified || false
//       }
//     });

//   } catch (error) {
//     // Enhanced error handling
//     if (error.name === 'JsonWebTokenError') {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid token",
//         details: error.message
//       });
//     }

//     if (error.name === 'TokenExpiredError') {
//       return res.status(401).json({
//         success: false,
//         message: "Token expired"
//       });
//     }

//     console.error('Progress Error:', error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching progress",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// }

// function determineNextStep(completedSteps) {
//   const stepsOrder = ['basicInfo', 'locationInfo', 'shopDetails', 'documents', 'bankDetails'];
//   for (const step of stepsOrder) {
//     if (!completedSteps.get(step)) return step;
//   }
//   return null;
// }

// async function updateProgress(req, res) {
//   try {
//     const { section } = req.params;
//     const validSections = ['basicInfo', 'locationInfo', 'shopDetails', 'documents', 'bankDetails'];

//     if (!validSections.includes(section)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid section"
//       });
//     }

//     const update = {
//       [`formProgress.completedSteps.${section}`]: true,
//       [`completionTimestamps.${section}`]: new Date(),
//       "formProgress.lastActiveStep": getStepNumber(section),
//       "formProgress.currentStep": getNextStepAfter(section)
//     };

//     await Vendor.findByIdAndUpdate(req.user._id, update);

//     res.status(200).json({
//       success: true,
//       message: "Progress updated successfully"
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error updating progress",
//       error: error.message
//     });
//   }
// };

// async function updateBasicInfo(req, res) {
//   try {
//     const { id } = req.params;
//     console.log("Updating basic info for vendor ID:", id);
//     const { fullName, personalEmail, phone, gender, dateOfBirth } = req.body;

//     if (!fullName || !personalEmail || !phone) {
//       return res.status(400).json({
//         success: false,
//         message: "Full name, email, and phone are required"
//       });
//     }

//     const vendor = await Vendor.findByIdAndUpdate(
//       id,
//       {
//         fullName,
//         personalEmail,
//         phone,
//         gender,
//         dateOfBirth,
//         "formProgress.completedSteps.basicInfo": true
//       },
//       { new: true }
//     );

//     if (!vendor) {
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found"
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Basic info updated successfully",
//       data: {
//         id: vendor._id,
//         fullName: vendor.fullName,
//         email: vendor.personalEmail,
//         updatedFields: Object.keys(req.body)
//       }
//     });
//   } catch (error) {
//     if (error.code === 11000) {
//       const field = Object.keys(error.keyPattern)[0];
//       return res.status(409).json({
//         success: false,
//         message: `${field} already exists`,
//         field: field
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error updating basic info",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// }

// async function updateLocationInfo(req, res) {
//   try {
//     const { id } = req.params;
//     const {
//       address,
//       city,
//       state,
//       pincode,
//       latitude,
//       longitude,
//       isPermanentAddress
//     } = req.body;

//     // Validate required fields
//     if (!address || !city || !state || !pincode) {
//       return res.status(400).json({
//         success: false,
//         message: "Address, city, state, and pincode are required"
//       });
//     }

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid vendor ID format"
//       });
//     }

//     const updateData = {
//       latitude,
//       longitude,
//       "formProgress.completedSteps.locationInfo": true,
//       "completionTimestamps.locationInfo": new Date(),
//       updatedAt: new Date()
//     };

//     if (isPermanentAddress) {
//       updateData.permanentAddress = { address, city, state };
//       updateData.shopPincode = pincode;
//     } else {
//       updateData.presentAddress = { address, city, state };
//       updateData.shopPincode = pincode;
//     }

//     const updatedVendor = await Vendor.findByIdAndUpdate(
//       id,
//       updateData,
//       {
//         new: true,
//         runValidators: true
//       }
//     ).select('presentAddress permanentAddress shopPincode latitude longitude formProgress completionTimestamps');

//     if (!updatedVendor) {
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found"
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Location info updated successfully",
//       data: {
//         address: isPermanentAddress ? updatedVendor.permanentAddress : updatedVendor.presentAddress,
//         pincode: updatedVendor.shopPincode,
//         coordinates: {
//           latitude: updatedVendor.latitude,
//           longitude: updatedVendor.longitude
//         },
//         progress: {
//           completed: updatedVendor.formProgress.completedSteps.locationInfo,
//           lastUpdated: updatedVendor.completionTimestamps.locationInfo
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Location update error:', error);

//     // Handle specific MongoDB errors
//     if (error.name === 'ValidationError') {
//       return res.status(400).json({
//         success: false,
//         message: "Validation failed",
//         errors: Object.values(error.errors).map(e => e.message)
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error updating location info",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// }

// async function updateShopDetails(req, res) {
//   try {
//     const { id } = req.params;
//     const { shopName, shopEmail, shopContact, holiday } = req.body;
//     const shopImages = req.files?.map(file => file.path) || [];

//     // Validate required fields
//     if (!shopName || !shopEmail || !shopContact) {
//       return res.status(400).json({
//         success: false,
//         message: "Vendor ID, shop name, email, and contact are required"
//       });
//     }

//     // Validate email format
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(shopEmail)) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide a valid shop email"
//       });
//     }

//     const updateData = {
//       shopName,
//       shopEmail,
//       shopContact,
//       holiday,
//       "formProgress.completedSteps.shopDetails": true,
//       "completionTimestamps.shopDetails": new Date(),
//       updatedAt: new Date()
//     };

//     // Only update images if new ones were uploaded
//     if (shopImages.length > 0) {
//       updateData.$push = { shopImages: { $each: shopImages } };
//     }

//     const updatedVendor = await Vendor.findByIdAndUpdate(
//       id,
//       updateData,
//       {
//         new: true,
//         runValidators: true
//       }
//     ).select('shopName shopEmail shopContact holiday shopImages formProgress completionTimestamps');

//     if (!updatedVendor) {
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found"
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Shop details updated successfully",
//       data: {
//         shopDetails: {
//           name: updatedVendor.shopName,
//           email: updatedVendor.shopEmail,
//           contact: updatedVendor.shopContact,
//           holiday: updatedVendor.holiday,
//           imageCount: updatedVendor.shopImages.length
//         },
//         progress: {
//           completed: updatedVendor.formProgress.completedSteps.shopDetails,
//           lastUpdated: updatedVendor.completionTimestamps.shopDetails
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Shop update error:', error);

//     // Handle duplicate key errors
//     if (error.code === 11000) {
//       return res.status(409).json({
//         success: false,
//         message: "Shop email already exists",
//         field: "shopEmail"
//       });
//     }

//     // Handle validation errors
//     if (error.name === 'ValidationError') {
//       return res.status(400).json({
//         success: false,
//         message: "Validation failed",
//         errors: Object.values(error.errors).map(e => e.message)
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error updating shop details",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// }

// // async function uploadDocuments(req, res) {
// //   try {
// //     const { id } = req.params;
// //     const files = req.files;

// //     // Check if any files were uploaded
// //     if (!files || Object.keys(files).length === 0) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "No documents were uploaded"
// //       });
// //     }

// //     const updates = {
// //       updatedAt: new Date(),
// //       "formProgress.completedSteps.documents": true,
// //       "completionTimestamps.documents": new Date()
// //     };

// //     // Add document paths only for the files that were actually uploaded
// //     if (files.aadharFront) updates["documents.aadharFront"] = files.aadharFront[0].path;
// //     if (files.aadharBack) updates["documents.aadharBack"] = files.aadharBack[0].path;
// //     if (files.panCard) updates["documents.panCard"] = files.panCard[0].path;
// //     if (files.shopCertificate) updates["documents.shopCertificate"] = files.shopCertificate[0].path;

// //     const updatedVendor = await Vendor.findByIdAndUpdate(
// //       id,
// //       updates,
// //       { 
// //         new: true,
// //         runValidators: true
// //       }
// //     ).select('documents formProgress completionTimestamps');

// //     if (!updatedVendor) {
// //       return res.status(404).json({
// //         success: false,
// //         message: "Vendor not found"
// //       });
// //     }

// //     res.status(200).json({
// //       success: true,
// //       message: "Documents uploaded successfully",
// //       data: {
// //         documents: {
// //           aadharFront: !!updatedVendor.documents.aadharFront,
// //           aadharBack: !!updatedVendor.documents.aadharBack,
// //           panCard: !!updatedVendor.documents.panCard,
// //           shopCertificate: !!updatedVendor.documents.shopCertificate
// //         },
// //         progress: {
// //           completed: updatedVendor.formProgress.completedSteps.documents,
// //           lastUpdated: updatedVendor.completionTimestamps.documents
// //         }
// //       }
// //     });

// //   } catch (error) {
// //     console.error('Document upload error:', error);

// //     // Handle file system errors
// //     if (error.code === 'ENOENT') {
// //       return res.status(500).json({
// //         success: false,
// //         message: "Error storing documents - file system error"
// //       });
// //     }

// //     // Handle validation errors
// //     if (error.name === 'ValidationError') {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Document validation failed",
// //         errors: Object.values(error.errors).map(e => e.message)
// //       });
// //     }

// //     res.status(500).json({
// //       success: false,
// //       message: "Error uploading documents",
// //       error: process.env.NODE_ENV === 'development' ? error.message : undefined
// //     });
// //   }
// // }

// // async function updateBankDetails(req, res) {
// //   try {
// //     const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;
// //     const passbookImage = req.file?.path;

// //     if (!accountHolderName || !accountNumber || !ifscCode || !bankName || !passbookImage) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "All bank details and passbook image are required"
// //       });
// //     }

// //     await Vendor.findByIdAndUpdate(
// //       req.user._id,
// //       {
// //         bankDetails: { accountHolderName, accountNumber, ifscCode, bankName },
// //         "documents.passbookImage": passbookImage,
// //         "formProgress.completedSteps.bankDetails": true
// //       }
// //     );

// //     res.status(200).json({
// //       success: true,
// //       message: "Bank details updated successfully"
// //     });
// //   } catch (error) {
// //     res.status(500).json({
// //       success: false,
// //       message: "Error updating bank details",
// //       error: error.message
// //     });
// //   }
// // };

// // Registration Submission & Status

// // async function uploadDocuments(req, res) {
// //   try {
// //     const { id } = req.params;
// //     const files = req.files;
// //     const { aadharCardNo, panCardNo, shopOpeningDate } = req.body;

// //     if (!files || Object.keys(files).length === 0) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "No documents were uploaded"
// //       });
// //     }

// //     const updates = {
// //       updatedAt: new Date(),
// //       "formProgress.completedSteps.documents": true,
// //       "completionTimestamps.documents": new Date()
// //     };

// //     // ✅ Add uploaded file paths
// //     if (files.aadharFront) updates["documents.aadharFront"] = files.aadharFront[0].path;
// //     if (files.aadharBack) updates["documents.aadharBack"] = files.aadharBack[0].path;
// //     if (files.panCard) updates["documents.panCardFront"] = files.panCard[0].path;
// //     if (files.shopCertificate) updates["documents.shopCertificate"] = files.shopCertificate[0].path;
// //     if (files.faceVerificationImage) updates["documents.faceVerificationImage"] = files.faceVerificationImage[0].path;

// //     // ✅ Add text fields if provided
// //     if (aadharCardNo) updates["aadharCardNo"] = aadharCardNo;
// //     if (panCardNo) updates["panCardNo"] = panCardNo;
// //     if (shopOpeningDate) updates["shopOpeningDate"] = new Date(shopOpeningDate);

// //     const updatedVendor = await Vendor.findByIdAndUpdate(
// //       id,
// //       updates,
// //       { new: true, runValidators: true }
// //     ).select('documents aadharCardNo panCardNo shopOpeningDate formProgress completionTimestamps');

// //     if (!updatedVendor) {
// //       return res.status(404).json({
// //         success: false,
// //         message: "Vendor not found"
// //       });
// //     }

// //     res.status(200).json({
// //       success: true,
// //       message: "Documents and info uploaded successfully",
// //       data: {
// //         documents: updatedVendor.documents,
// //         aadharCardNo: updatedVendor.aadharCardNo,
// //         panCardNo: updatedVendor.panCardNo,
// //         shopOpeningDate: updatedVendor.shopOpeningDate,
// //         progress: {
// //           completed: updatedVendor.formProgress.completedSteps.documents,
// //           lastUpdated: updatedVendor.completionTimestamps.documents
// //         }
// //       }
// //     });

// //   } catch (error) {
// //     console.error('Document upload error:', error);

// //     if (error.code === 'ENOENT') {
// //       return res.status(500).json({
// //         success: false,
// //         message: "Error storing documents - file system error"
// //       });
// //     }

// //     if (error.name === 'ValidationError') {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Validation failed",
// //         errors: Object.values(error.errors).map(e => e.message)
// //       });
// //     }

// //     res.status(500).json({
// //       success: false,
// //       message: "Error uploading documents",
// //       error: process.env.NODE_ENV === 'development' ? error.message : undefined
// //     });
// //   }
// // }

// async function uploadDocuments(req, res) {
//   try {
//     const { id } = req.params;
//     const files = req.files;
//     const { aadharCardNo, panCardNo, shopOpeningDate } = req.body;

//     if (!files || Object.keys(files).length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No documents were uploaded"
//       });
//     }

//     const updates = {
//       updatedAt: new Date(),
//       "formProgress.completedSteps.documents": true,
//       "completionTimestamps.documents": new Date()
//     };

//     // ✅ Add uploaded file paths
//     if (files.aadharFront) updates["documents.aadharFront"] = files.aadharFront[0].path;
//     if (files.aadharBack) updates["documents.aadharBack"] = files.aadharBack[0].path;
//     if (files.panCard) updates["documents.panCardFront"] = files.panCard[0].path;
//     if (files.shopCertificate) updates["documents.shopCertificate"] = files.shopCertificate[0].path;
//     if (files.faceVerificationImage) updates["documents.faceVerificationImage"] = files.faceVerificationImage[0].path;

//     // ✅ Add text fields if provided
//     if (aadharCardNo) updates["aadharCardNo"] = aadharCardNo;
//     if (panCardNo) updates["panCardNo"] = panCardNo;
//     if (shopOpeningDate) updates["shopOpeningDate"] = new Date(shopOpeningDate);

//     // --- NEW BLOCK: Update document flags ---
//     updates.isDoc = true; // mark that documents are uploaded
//     updates["documentVerification.aadhar"] = !!(files.aadharFront && files.aadharBack);
//     updates["documentVerification.pan"] = !!files.panCard;
//     updates["documentVerification.shop"] = !!files.shopCertificate;
//     updates["documentVerification.face"] = !!files.faceVerificationImage;
//     // --- END OF BLOCK ---

//     const updatedVendor = await Vendor.findByIdAndUpdate(
//       id,
//       updates,
//       { new: true, runValidators: true }
//     ).select('documents aadharCardNo panCardNo shopOpeningDate formProgress completionTimestamps isDoc documentVerification');

//     if (!updatedVendor) {
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found"
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Documents and info uploaded successfully",
//       data: {
//         documents: updatedVendor.documents,
//         aadharCardNo: updatedVendor.aadharCardNo,
//         panCardNo: updatedVendor.panCardNo,
//         shopOpeningDate: updatedVendor.shopOpeningDate,
//         progress: {
//           completed: updatedVendor.formProgress.completedSteps.documents,
//           lastUpdated: updatedVendor.completionTimestamps.documents
//         },
//         isDoc: updatedVendor.isDoc,
//         documentVerification: updatedVendor.documentVerification
//       }
//     });

//   } catch (error) {
//     console.error('Document upload error:', error);

//     if (error.code === 'ENOENT') {
//       return res.status(500).json({
//         success: false,
//         message: "Error storing documents - file system error"
//       });
//     }

//     if (error.name === 'ValidationError') {
//       return res.status(400).json({
//         success: false,
//         message: "Validation failed",
//         errors: Object.values(error.errors).map(e => e.message)
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error uploading documents",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// }

// async function updateBankDetails(req, res) {
//   try {
//     const { id } = req.params;
//     const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;
//     const passbookImage = req.file?.path;

//     // Validate required fields
//     if (!accountHolderName || !accountNumber || !ifscCode || !bankName || !passbookImage) {
//       return res.status(400).json({
//         success: false,
//         message: "All bank details and passbook image are required"
//       });
//     }

//     // Validate ID format
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid vendor ID format"
//       });
//     }

//     // Validate IFSC code format (example validation)
//     if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid IFSC code format"
//       });
//     }

//     // Validate account number (basic check)
//     if (!/^\d{9,18}$/.test(accountNumber)) {
//       return res.status(400).json({
//         success: false,
//         message: "Account number must be 9-18 digits"
//       });
//     }

//     const updatedVendor = await Vendor.findByIdAndUpdate(
//       id,
//       {
//         bankDetails: {
//           accountHolderName,
//           accountNumber,
//           ifscCode,
//           bankName
//         },
//         "documents.passbookImage": passbookImage,
//         "formProgress.completedSteps.bankDetails": true,
//         "completionTimestamps.bankDetails": new Date(),
//         updatedAt: new Date()
//       },
//       {
//         new: true,
//         runValidators: true
//       }
//     ).select('bankDetails documents.passbookImage formProgress completionTimestamps');

//     if (!updatedVendor) {
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found"
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Bank details updated successfully",
//       data: {
//         bankDetails: updatedVendor.bankDetails,
//         hasPassbookImage: !!updatedVendor.documents.passbookImage,
//         progress: {
//           completed: updatedVendor.formProgress.completedSteps.bankDetails,
//           lastUpdated: updatedVendor.completionTimestamps.bankDetails
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Bank details update error:', error);

//     // Handle duplicate account errors
//     if (error.code === 11000 && error.keyPattern?.bankDetails?.accountNumber) {
//       return res.status(409).json({
//         success: false,
//         message: "Bank account already registered",
//         field: "accountNumber"
//       });
//     }

//     // Handle validation errors
//     if (error.name === 'ValidationError') {
//       return res.status(400).json({
//         success: false,
//         message: "Bank details validation failed",
//         errors: Object.values(error.errors).map(e => e.message)
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error updating bank details",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// }

// async function submitForApproval(req, res) {
//   try {
//     const { id } = req.params;
//     const vendor = await Vendor.findById(id);
//     console.log("Submitting registration for vendor ID:", id);
//     console.log("Vendor details:", vendor);
//     const allCompleted = Array.from(vendor.formProgress.completedSteps.values())
//       .every(val => val === true);

//     if (!allCompleted) {
//       return res.status(400).json({
//         success: false,
//         message: "Please complete all sections before submitting"
//       });
//     }

//     if (!vendor.documents.aadharFront || !vendor.documents.panCardFront || !vendor.documents.shopCertificate) {
//       return res.status(400).json({
//         success: false,
//         message: "Please upload all required documents (Aadhar Front, PAN Card Front, and Shop Certificate)"
//       });
//     }

//     vendor.registrationStatus = 'Pending';
//     vendor.submittedAt = new Date();
//     await vendor.save();

//     res.status(200).json({
//       success: true,
//       message: "Registration submitted for admin approval"
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error submitting registration",
//       error: error.message
//     });
//   }
// };

// async function checkApprovalStatus(req, res) {
//   try {
//     const vendor = await Vendor.findById(req.user._id)
//       .select("registrationStatus adminNotes submittedAt approvedAt");

//     res.status(200).json({
//       success: true,
//       status: vendor.registrationStatus,
//       adminNotes: vendor.adminNotes,
//       submittedAt: vendor.submittedAt,
//       approvedAt: vendor.approvedAt
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error checking approval status",
//       error: error.message
//     });
//   }
// };

// // Admin Endpoints
// // async function getPendingRegistrations(req, res) {
// //   try {
// //     const pendingVendors = await Vendor.find({ registrationStatus: 'Pending' }).lean();

// //     console.log("pendingVendors", pendingVendors)

// //     // Map through vendors to ensure status structure is consistent
// //     const formattedVendors = pendingVendors.map(vendor => {
// //       return {
// //         ...vendor,
// //         status: {
// //           adminApproved: vendor.status?.adminApproved || false,
// //           isActive: vendor.status?.isActive || false,
// //           isVerified: vendor.status?.isVerified || false
// //         }
// //       };
// //     });

// //     res.status(200).json({
// //       success: true,
// //       count: formattedVendors.length,
// //       vendors: formattedVendors
// //     });
// //   } catch (error) {
// //     res.status(500).json({
// //       success: false,
// //       message: "Error fetching pending registrations",
// //       error: error.message
// //     });
// //   }
// // };

// async function getPendingRegistrations(req, res) {
//   try {
//     const pendingVendors = await Vendor.find({
//       registrationStatus: 'Pending',
//       $or: [
//         { "status.adminApproved": false },
//         { "status.isActive": false },
//         { "status.isVerified": false }
//       ]
//     }).lean();

//     res.status(200).json({
//       success: true,
//       count: pendingVendors.length,
//       vendors: pendingVendors
//     });
//   } catch (error) {
//     console.error("Error fetching pending registrations:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching pending registrations",
//       error: error.message
//     });
//   }
// }

// async function getDealerDetails(req, res) {
//   try {
//     const vendor = await Vendor.findById(req.params.id)
//       .select("-password -otp -otpExpiry");

//     if (!vendor) {
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found"
//       });
//     }

//     res.status(200).json({
//       success: true,
//       vendor
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error fetching vendor details",
//       error: error.message
//     });
//   }
// };

// async function approveDealer(req, res) {
//   try {
//     console.log("Id:- ", req.params.id);

//     // First check if vendor exists
//     const vendorExists = await Vendor.findById(req.params.id);
//     if (!vendorExists) {
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found"
//       });
//     }

//     // Then try to update
//     const vendor = await Vendor.findByIdAndUpdate(
//       req.params.id,
//       {
//         registrationStatus: 'Approved',
//         approvedAt: new Date(),
//         isActive: true,
//         "status.adminApproved": true,
//         "status.isActive": true,
//         "status.isVerified": true
//       },
//       { new: true }
//     );

//     res.status(200).json({
//       success: true,
//       message: "Vendor approved successfully",
//       data: {
//         vendor,
//         status: {
//           adminApproved: true,
//           isActive: true,
//           isVerified: true
//         }
//       }
//     });
//   } catch (error) {
//     console.error("Full error:", error); // Log the complete error
//     res.status(500).json({
//       success: false,
//       message: "Error approving vendor",
//       error: error.message,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
//   }
// }

// // async function rejectDealer(req, res) {
// //   try {
// //     const { notes } = req.body;

// //     const vendor = await Vendor.findByIdAndUpdate(
// //       req.params.id,
// //       {
// //         registrationStatus: 'Rejected',
// //         adminNotes: notes,
// //         isActive: false,
// //         'status.adminApproved': false,
// //         'status.isActive': false,
// //       },
// //       { new: true }
// //     );

// //     // Send rejection notification
// //     await sendRejectionEmail(vendor, notes);

// //     res.status(200).json({
// //       success: true,
// //       message: "Vendor rejected successfully",
// //       data: {
// //         status: {
// //           adminApproved: false,
// //           isActive: false,
// //           isVerified: vendor.isVerify
// //         }
// //       }
// //     });
// //   } catch (error) {
// //     res.status(500).json({
// //       success: false,
// //       message: "Error rejecting vendor",
// //       error: error.message
// //     });
// //   }
// // };

// async function rejectDealer(req, res) {
//   try {
//     const { notes } = req.body;

//     // Find the vendor first
//     const vendor = await Vendor.findById(req.params.id);

//     if (!vendor) {
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found"
//       });
//     }

//     // Send rejection email BEFORE deletion
//     await sendRejectionEmail(vendor, notes);

//     // Delete vendor after rejection
//     await Vendor.findByIdAndDelete(req.params.id);

//     res.status(200).json({
//       success: true,
//       message: "Vendor rejected and deleted successfully",
//       data: {
//         vendorId: req.params.id,
//         deleted: true
//       }
//     });

//   } catch (error) {
//     console.error("Reject dealer error:", error);

//     res.status(500).json({
//       success: false,
//       message: "Error rejecting vendor",
//       error: error.message
//     });
//   }
// }

// function getStepNumber(section) {
//   const stepMap = {
//     'basicInfo': 1,
//     'locationInfo': 2,
//     'shopDetails': 3,
//     'documents': 4,
//     'bankDetails': 5
//   };
//   return stepMap[section];
// }

// function getNextStepAfter(section) {
//   const stepsOrder = ['basicInfo', 'locationInfo', 'shopDetails', 'documents', 'bankDetails'];
//   const currentIndex = stepsOrder.indexOf(section);
//   return currentIndex < stepsOrder.length - 1 ? getStepNumber(stepsOrder[currentIndex + 1]) : 5;
// }

// // async function notifyAdmin(vendorId) {
// //   const admins = await Admin.find({ role: 'admin' }).select("email");
// //   const adminEmails = admins.map(admin => admin.email);

// //   await sendEmail({
// //     to: adminEmails,
// //     subject: 'New Vendor Registration Requires Approval',
// //     html: `<p>A new vendor registration requires your approval. 
// //            <a href="${process.env.ADMIN_PORTAL_URL}/vendors/${vendorId}">Review now</a></p>`
// //   });
// // }

// async function sendRejectionEmail(vendor, notes) {
//   await sendEmail({
//     to: vendor.personalEmail,
//     subject: 'Your Vendor Registration Status',
//     html: `<p>Your registration was rejected. Admin notes: ${notes}</p>`
//   });
// }

// module.exports = {
//   usersignin,
//   sendOtp,
//   verifyOTP,
//   logout,
//   changePassword,
//   resendOtp,
//   getProgress,
//   updateProgress,
//   updateBasicInfo,
//   updateLocationInfo,
//   updateShopDetails,
//   uploadDocuments,
//   updateBankDetails,
//   submitForApproval,
//   checkApprovalStatus,
//   getPendingRegistrations,
//   getDealerDetails,
//   approveDealer,
//   rejectDealer
// };





var validation = require("../helper/validation")
const otpAuth = require("../helper/otpAuth")
const Dealer = require("../models/Dealer")
const Vendor = require("../models/dealerModel")
const Admin = require("../models/admin_model")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")
const { sendemails } = require("../helper/helper")

async function sendOtp(req, res) {
  try {
    const { phone } = req.body

    if (phone != "" || phone === null) {
      var userResm = await Dealer.findOne({ phone })

      if (userResm) {
        const data = await otpAuth.otp(phone)

        Dealer.findByIdAndUpdate({ _id: userResm._id }, { otp: data.otp }, { new: true }, async (err, docs) => {
          if (err) {
            return res.status(201).send({
              status: 201,
              message: err,
            })
          } else {
            return res.status(200).json({
              status: 200,
              message: "OTP send successfully",
            })
          }
        })
      } else {
        return res.status(201).send({
          status: 201,
          message: "Dealer not exist",
        })
      }
    } else {
      return res.status(201).send({
        status: 201,
        message: "Phone No can not be empty value!",
      })
    }
  } catch (error) {
    console.log("error", error)
    return res.status(201).send({
      status: 201,
      message: "Operation was not successful",
    })
  }
}

// async function usersignin(req, res) {
//   try {
//     const { phone, ftoken, device_token } = req.body;

//     if (!phone) {
//       return res.status(400).json({
//         success: false,
//         message: 'Phone number is required!'
//       });
//     }

//     let dealer = await Vendor.findOne({ phone, isActive: true, isBlock: false });

//     const otpData = await otpAuth.otp(phone);
//     const otp = otpData.otp;

//     if (!dealer) {
//       dealer = new Vendor({
//         phone,
//         otp,
//         ftoken,
//         device_token,
//         isActive: true,
//         isVerify: false,
//         isProfile: false,
//         isDoc: false,
//       });
//     } else {
//       dealer.otp = otp;
//       dealer.ftoken = ftoken;
//       dealer.device_token = device_token;
//       dealer.isActive = true;
//     }

//     await dealer.save();

//     res.status(dealer.isNew ? 201 : 200).json({
//       success: true,
//       message: 'OTP sent to your mobile.',
//       data: {
//         phone: dealer.phone,
//         isVerify: dealer.isVerify,
//         isDoc: dealer.isDoc,
//         isProfile: dealer.isProfile
//       }
//     });

//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// }

async function usersignin(req, res) {
  try {
    const { phone, ftoken, device_token } = req.body

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required!",
      })
    }

    const otp = "9999"
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000)

    let dealer = await Vendor.findOne({ phone })

    if (!dealer) {
      // new dealer creation
      dealer = new Vendor({
        phone,
        otp,
        otpExpiry,
        ftoken,
        device_token,
        isActive: true,
        isVerify: false,
        isProfile: false,
        isDoc: false,
      })
    } else {
      // update existing dealer
      dealer.otp = otp
      dealer.otpExpiry = otpExpiry
      dealer.ftoken = ftoken || dealer.ftoken
      dealer.device_token = device_token || dealer.device_token
      dealer.isActive = true
    }

    await dealer.save()

    return res.status(dealer.isNew ? 201 : 200).json({
      success: true,
      message: "OTP sent to your mobile.",
      data: {
        phone: dealer.phone,
        isVerify: dealer.isVerify,
        isDoc: dealer.isDoc,
        isProfile: dealer.isProfile,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      ...(process.env.NODE_ENV === "development" ? { error: error.message } : {}),
    })
  }
}

async function verifyOTP(req, res) {
  try {
    const { otp, phone } = req.body

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      })
    }

    const dealer = await Vendor.findOne({ phone })

    if (otp !== "9999") {
      return res.status(401).json({
        success: false,
        message: "Incorrect OTP",
      })
    }

    if (!dealer) {
      const newDealer = new Vendor({
        phone,
        email: `user_${Date.now()}_${Math.floor(Math.random() * 10000)}@autogen.dr`,
        isVerify: false,
        isProfile: false,
        isDoc: false,
        isActive: true,
      })

      await newDealer.save()

      const token = validation.generateUserToken(newDealer._id, "dealer", "2h")

      return res.status(201).json({
        success: true,
        message: "New user created successfully",
        data: {
          dealer_id: newDealer._id,
          token,
          isNewUser: true,
          status: {
            isVerify: newDealer.isVerify,
            isDoc: newDealer.isDoc,
            isProfile: newDealer.isProfile,
          },
        },
      })
    }

    const token = validation.generateUserToken(dealer._id, "dealer", "2h")
    const isNewUser = !dealer.isProfile || !dealer.isDoc || !dealer.isVerify

    return res.status(200).json({
      success: true,
      message: isNewUser ? "Signup in progress" : "Login successful",
      data: {
        dealer_id: dealer._id,
        token,
        isNewUser,
        status: {
          isVerify: dealer.isVerify,
          isDoc: dealer.isDoc,
          isProfile: dealer.isProfile,
        },
      },
    })
  } catch (error) {
    console.error("OTP verification error:", error)

    if (error.code === 11000) {
      if (error.keyPattern.phone) {
        return res.status(409).json({
          success: false,
          message: "Phone number already registered",
        })
      }
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      })
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    })
  }
}

async function changePassword(req, res) {
  try {
    const { phone, new_password, confirm_password } = req.body

    const dealers = await Dealer.findOne({ phone }).select("+password")

    if (!dealers) {
      return res.status(201).send({
        status: 201,
        message: "Mobile no not exist",
      })
    }

    if (validation.comparePassword(dealers.password, new_password)) {
      return res.status(201).send({
        status: 201,
        message: "New Password can not Same as Old Password",
      })
    }

    if (new_password != confirm_password) {
      return res.status(201).send({
        status: 201,
        message: "Password Not Matched",
      })
    }

    const datas = {
      password: validation.hashPassword(new_password),
    }

    var where = { _id: dealers._id }

    Dealer.findByIdAndUpdate(where, { $set: datas }, { new: true }, async (err, docs) => {
      if (err) {
        return res.status(201).send({
          status: 201,
          message: err,
        })
      } else {
        return res.status(200).send({
          status: 200,
          message: "Dealer Password Updated Successfully",
          // data: docs,
        })
      }
    })
  } catch (error) {
    console.log("error", error)
    return res.status(201).send({
      status: 201,
      message: "Operation was not successful",
    })
  }
}

async function logout(req, res) {
  try {
    // res.clearCookie('refreshToken')
    res
      .status(200)
      .cookie("token", null, { expires: new Date(Date.now()), httpOnly: true })
      .cookie("accessToken", null, { expires: new Date(Date.now()), httpOnly: true })
      .cookie("refreshToken", null, { expires: new Date(Date.now()), httpOnly: true })
      .cookie("authSession", null, { expires: new Date(Date.now()), httpOnly: true })
      .cookie("refreshTokenID", null, { expires: new Date(Date.now()), httpOnly: true })
      .json({
        success: true,
        message: "Logged out",
      })
  } catch (error) {
    console.log("error", error)
    return res.status(201).send({
      status: 201,
      message: "Operation was not successful",
    })
  }
}

async function resendOtp(req, res) {
  try {
    const { phone } = req.body
    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" })
    }

    const user = await Dealer.findOne({ phone })
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    const otpData = await otpAuth.otp(phone)
    user.otp = otpData.otp
    await user.save()

    res.status(200).json({ success: true, message: "OTP sent successfully" })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

async function getProgress(req, res) {
  try {
    // 1. Extract and validate token format
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization header with Bearer token required",
      })
    }

    const token = authHeader.split(" ")[1]

    // 2. Verify token with same secret used in generation
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      ignoreExpiration: false,
    })

    console.log("Decoded Token:", decoded)

    // 3. Check for required fields in payload
    if (!decoded.user_id) {
      return res.status(401).json({
        success: false,
        message: "Token missing required user_id field",
      })
    }

    // 4. Find vendor (now using user_id instead of _id)
    const vendor = await Vendor.findById(decoded.user_id)
    // .select("formProgress completionTimestamps isActive adminApproved");
    // .select("formProgress completionTimestamps");

    console.log("Vendor detaials", vendor)

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      })
    }

    // 5. Return progress data
    res.status(200).json({
      success: true,
      currentStep: vendor.formProgress.currentStep,
      nextStep: determineNextStep(vendor.formProgress.completedSteps),
      completedSteps: Object.fromEntries(vendor.formProgress.completedSteps),
      timestamps: vendor.completionTimestamps,
      status: {
        adminApproved: vendor.status.adminApproved || false,
        isActive: vendor.status.isActive || false,
        isVerified: vendor.status.isVerified || false,
      },
    })
  } catch (error) {
    // Enhanced error handling
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
        details: error.message,
      })
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      })
    }

    console.error("Progress Error:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching progress",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

function determineNextStep(completedSteps) {
  const stepsOrder = ["basicInfo", "locationInfo", "shopDetails", "documents", "bankDetails"]
  for (const step of stepsOrder) {
    if (!completedSteps.get(step)) return step
  }
  return null
}

async function updateProgress(req, res) {
  try {
    const { section } = req.params
    const validSections = ["basicInfo", "locationInfo", "shopDetails", "documents", "bankDetails"]

    if (!validSections.includes(section)) {
      return res.status(400).json({
        success: false,
        message: "Invalid section",
      })
    }

    const update = {
      [`formProgress.completedSteps.${section}`]: true,
      [`completionTimestamps.${section}`]: new Date(),
      "formProgress.lastActiveStep": getStepNumber(section),
      "formProgress.currentStep": getNextStepAfter(section),
    }

    await Vendor.findByIdAndUpdate(req.user._id, update)

    res.status(200).json({
      success: true,
      message: "Progress updated successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating progress",
      error: error.message,
    })
  }
}

async function updateBasicInfo(req, res) {
  try {
    const { id } = req.params
    console.log("Updating basic info for vendor ID:", id)
    const { fullName, personalEmail, phone, gender, dateOfBirth } = req.body

    if (!fullName || !personalEmail || !phone) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and phone are required",
      })
    }

    const vendor = await Vendor.findByIdAndUpdate(
      id,
      {
        fullName,
        personalEmail,
        phone,
        gender,
        dateOfBirth,
        "formProgress.completedSteps.basicInfo": true,
      },
      { new: true },
    )

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Basic info updated successfully",
      data: {
        id: vendor._id,
        fullName: vendor.fullName,
        email: vendor.personalEmail,
        updatedFields: Object.keys(req.body),
      },
    })
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
        field: field,
      })
    }

    res.status(500).json({
      success: false,
      message: "Error updating basic info",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

async function updateLocationInfo(req, res) {
  try {
    const { id } = req.params
    const { address, city, state, pincode, latitude, longitude, isPermanentAddress } = req.body

    // Validate required fields
    if (!address || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: "Address, city, state, and pincode are required",
      })
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID format",
      })
    }

    const updateData = {
      latitude,
      longitude,
      "formProgress.completedSteps.locationInfo": true,
      "completionTimestamps.locationInfo": new Date(),
      updatedAt: new Date(),
    }

    if (isPermanentAddress) {
      updateData.permanentAddress = { address, city, state }
      updateData.shopPincode = pincode
    } else {
      updateData.presentAddress = { address, city, state }
      updateData.shopPincode = pincode
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("presentAddress permanentAddress shopPincode latitude longitude formProgress completionTimestamps")

    if (!updatedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Location info updated successfully",
      data: {
        address: isPermanentAddress ? updatedVendor.permanentAddress : updatedVendor.presentAddress,
        pincode: updatedVendor.shopPincode,
        coordinates: {
          latitude: updatedVendor.latitude,
          longitude: updatedVendor.longitude,
        },
        progress: {
          completed: updatedVendor.formProgress.completedSteps.locationInfo,
          lastUpdated: updatedVendor.completionTimestamps.locationInfo,
        },
      },
    })
  } catch (error) {
    console.error("Location update error:", error)

    // Handle specific MongoDB errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(error.errors).map((e) => e.message),
      })
    }

    res.status(500).json({
      success: false,
      message: "Error updating location info",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

async function updateShopDetails(req, res) {
  try {
    const { id } = req.params
    const { shopName, shopEmail, shopContact, holiday } = req.body
    const shopImages = req.files?.map(file => file.location) || [];


    // Validate required fields
    if (!shopName || !shopEmail || !shopContact) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID, shop name, email, and contact are required",
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(shopEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid shop email",
      })
    }

    const updateData = {
      shopName,
      shopEmail,
      shopContact,
      holiday,
      "formProgress.completedSteps.shopDetails": true,
      "completionTimestamps.shopDetails": new Date(),
      updatedAt: new Date(),
    }

    if (shopImages.length > 0) {
      updateData.$push = { shopImages: { $each: shopImages } };
    }


    const updatedVendor = await Vendor.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("shopName shopEmail shopContact holiday shopImages formProgress completionTimestamps")

    if (!updatedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Shop details updated successfully",
      data: {
        shopDetails: {
          name: updatedVendor.shopName,
          email: updatedVendor.shopEmail,
          contact: updatedVendor.shopContact,
          holiday: updatedVendor.holiday,
          imageCount: updatedVendor.shopImages.length,
        },
        progress: {
          completed: updatedVendor.formProgress.completedSteps.shopDetails,
          lastUpdated: updatedVendor.completionTimestamps.shopDetails,
        },
      },
    })
  } catch (error) {
    console.error("Shop update error:", error)

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Shop email already exists",
        field: "shopEmail",
      })
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(error.errors).map((e) => e.message),
      })
    }

    res.status(500).json({
      success: false,
      message: "Error updating shop details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// async function uploadDocuments(req, res) {
//   try {
//     const { id } = req.params;
//     const files = req.files;

//     // Check if any files were uploaded
//     if (!files || Object.keys(files).length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No documents were uploaded"
//       });
//     }

//     const updates = {
//       updatedAt: new Date(),
//       "formProgress.completedSteps.documents": true,
//       "completionTimestamps.documents": new Date()
//     };

//     // Add document paths only for the files that were actually uploaded
//     if (files.aadharFront) updates["documents.aadharFront"] = files.aadharFront[0].path;
//     if (files.aadharBack) updates["documents.aadharBack"] = files.aadharBack[0].path;
//     if (files.panCard) updates["documents.panCard"] = files.panCard[0].path;
//     if (files.shopCertificate) updates["documents.shopCertificate"] = files.shopCertificate[0].path;

//     const updatedVendor = await Vendor.findByIdAndUpdate(
//       id,
//       updates,
//       {
//         new: true,
//         runValidators: true
//       }
//     ).select('documents formProgress completionTimestamps');

//     if (!updatedVendor) {
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found"
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Documents uploaded successfully",
//       data: {
//         documents: {
//           aadharFront: !!updatedVendor.documents.aadharFront,
//           aadharBack: !!updatedVendor.documents.aadharBack,
//           panCard: !!updatedVendor.documents.panCard,
//           shopCertificate: !!updatedVendor.documents.shopCertificate
//         },
//         progress: {
//           completed: updatedVendor.formProgress.completedSteps.documents,
//           lastUpdated: updatedVendor.completionTimestamps.documents
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Document upload error:', error);

//     // Handle file system errors
//     if (error.code === 'ENOENT') {
//       return res.status(500).json({
//         success: false,
//         message: "Error storing documents - file system error"
//       });
//     }

//     // Handle validation errors
//     if (error.name === 'ValidationError') {
//       return res.status(400).json({
//         success: false,
//         message: "Document validation failed",
//         errors: Object.values(error.errors).map(e => e.message)
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error uploading documents",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// }

// async function updateBankDetails(req, res) {
//   try {
//     const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;
//     const passbookImage = req.file?.path;

//     if (!accountHolderName || !accountNumber || !ifscCode || !bankName || !passbookImage) {
//       return res.status(400).json({
//         success: false,
//         message: "All bank details and passbook image are required"
//       });
//     }

//     await Vendor.findByIdAndUpdate(
//       req.user._id,
//       {
//         bankDetails: { accountHolderName, accountNumber, ifscCode, bankName },
//         "documents.passbookImage": passbookImage,
//         "formProgress.completedSteps.bankDetails": true
//       }
//     );

//     res.status(200).json({
//       success: true,
//       message: "Bank details updated successfully"
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error updating bank details",
//       error: error.message
//     });
//   }
// };

// Registration Submission & Status

// async function uploadDocuments(req, res) {
//   try {
//     const { id } = req.params;
//     const files = req.files;
//     const { aadharCardNo, panCardNo, shopOpeningDate } = req.body;

//     if (!files || Object.keys(files).length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No documents were uploaded"
//       });
//     }

//     const updates = {
//       updatedAt: new Date(),
//       "formProgress.completedSteps.documents": true,
//       "completionTimestamps.documents": new Date()
//     };

//     // ✅ Add uploaded file paths
//     if (files.aadharFront) updates["documents.aadharFront"] = files.aadharFront[0].path;
//     if (files.aadharBack) updates["documents.aadharBack"] = files.aadharBack[0].path;
//     if (files.panCard) updates["documents.panCardFront"] = files.panCard[0].path;
//     if (files.shopCertificate) updates["documents.shopCertificate"] = files.shopCertificate[0].path;
//     if (files.faceVerificationImage) updates["documents.faceVerificationImage"] = files.faceVerificationImage[0].path;

//     // ✅ Add text fields if provided
//     if (aadharCardNo) updates["aadharCardNo"] = aadharCardNo;
//     if (panCardNo) updates["panCardNo"] = panCardNo;
//     if (shopOpeningDate) updates["shopOpeningDate"] = new Date(shopOpeningDate);

//     const updatedVendor = await Vendor.findByIdAndUpdate(
//       id,
//       updates,
//       { new: true, runValidators: true }
//     ).select('documents aadharCardNo panCardNo shopOpeningDate formProgress completionTimestamps');

//     if (!updatedVendor) {
//       return res.status(404).json({
//         success: false,
//         message: "Vendor not found"
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Documents and info uploaded successfully",
//       data: {
//         documents: updatedVendor.documents,
//         aadharCardNo: updatedVendor.aadharCardNo,
//         panCardNo: updatedVendor.panCardNo,
//         shopOpeningDate: updatedVendor.shopOpeningDate,
//         progress: {
//           completed: updatedVendor.formProgress.completedSteps.documents,
//           lastUpdated: updatedVendor.completionTimestamps.documents
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Document upload error:', error);

//     if (error.code === 'ENOENT') {
//       return res.status(500).json({
//         success: false,
//         message: "Error storing documents - file system error"
//       });
//     }

//     if (error.name === 'ValidationError') {
//       return res.status(400).json({
//         success: false,
//         message: "Validation failed",
//         errors: Object.values(error.errors).map(e => e.message)
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error uploading documents",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// }

async function uploadDocuments(req, res) {
  try {
    const { id } = req.params
    const files = req.files
    const { aadharCardNo, panCardNo, shopOpeningDate } = req.body

    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No documents were uploaded",
      })
    }

    const updates = {
      updatedAt: new Date(),
      "formProgress.completedSteps.documents": true,
      "completionTimestamps.documents": new Date(),
    }

    // ✅ Add uploaded file paths
    if (files.aadharFront) updates["documents.aadharFront"] = files.aadharFront[0].location;
    if (files.aadharBack) updates["documents.aadharBack"] = files.aadharBack[0].location;
    if (files.panCard) updates["documents.panCardFront"] = files.panCard[0].location;
    if (files.shopCertificate) updates["documents.shopCertificate"] = files.shopCertificate[0].location;
    if (files.faceVerificationImage) updates["documents.faceVerificationImage"] = files.faceVerificationImage[0].location;

    // ✅ Add text fields if provided
    if (aadharCardNo) updates["aadharCardNo"] = aadharCardNo
    if (panCardNo) updates["panCardNo"] = panCardNo
    if (shopOpeningDate) updates["shopOpeningDate"] = new Date(shopOpeningDate)

    // --- NEW BLOCK: Update document flags ---
    updates.isDoc = true // mark that documents are uploaded
    updates["documentVerification.aadharFront"] = !!files.aadharFront
    updates["documentVerification.aadharBack"] = !!files.aadharBack
    updates["documentVerification.pan"] = !!files.panCard
    updates["documentVerification.shop"] = !!files.shopCertificate
    updates["documentVerification.face"] = !!files.faceVerificationImage
    // --- END OF BLOCK ---

    const updatedVendor = await Vendor.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select(
      "documents aadharCardNo panCardNo shopOpeningDate formProgress completionTimestamps isDoc documentVerification",
    )

    if (!updatedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Documents and info uploaded successfully",
      data: {
        documents: updatedVendor.documents,
        aadharCardNo: updatedVendor.aadharCardNo,
        panCardNo: updatedVendor.panCardNo,
        shopOpeningDate: updatedVendor.shopOpeningDate,
        progress: {
          completed: updatedVendor.formProgress.completedSteps.documents,
          lastUpdated: updatedVendor.completionTimestamps.documents,
        },
        isDoc: updatedVendor.isDoc,
        documentVerification: updatedVendor.documentVerification,
      },
    })
  } catch (error) {
    console.error("Document upload error:", error)

    if (error.code === "ENOENT") {
      return res.status(500).json({
        success: false,
        message: "Error storing documents - file system error",
      })
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(error.errors).map((e) => e.message),
      })
    }

    res.status(500).json({
      success: false,
      message: "Error uploading documents",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

async function updateBankDetails(req, res) {
  try {
    const { id } = req.params
    const { accountHolderName, accountNumber, ifscCode, bankName } = req.body
    const passbookImage = req.file?.path

    // Validate required fields
    if (!accountHolderName || !accountNumber || !ifscCode || !bankName || !passbookImage) {
      return res.status(400).json({
        success: false,
        message: "All bank details and passbook image are required",
      })
    }

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID format",
      })
    }

    // Validate IFSC code format (example validation)
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid IFSC code format",
      })
    }

    // Validate account number (basic check)
    if (!/^\d{9,18}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: "Account number must be 9-18 digits",
      })
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(
      id,
      {
        bankDetails: {
          accountHolderName,
          accountNumber,
          ifscCode,
          bankName,
        },
        "documents.passbookImage": passbookImage,
        "formProgress.completedSteps.bankDetails": true,
        "completionTimestamps.bankDetails": new Date(),
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
      },
    ).select("bankDetails documents.passbookImage formProgress completionTimestamps")

    if (!updatedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Bank details updated successfully",
      data: {
        bankDetails: updatedVendor.bankDetails,
        hasPassbookImage: !!updatedVendor.documents.passbookImage,
        progress: {
          completed: updatedVendor.formProgress.completedSteps.bankDetails,
          lastUpdated: updatedVendor.completionTimestamps.bankDetails,
        },
      },
    })
  } catch (error) {
    console.error("Bank details update error:", error)

    // Handle duplicate account errors
    if (error.code === 11000 && error.keyPattern?.bankDetails?.accountNumber) {
      return res.status(409).json({
        success: false,
        message: "Bank account already registered",
        field: "accountNumber",
      })
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Bank details validation failed",
        errors: Object.values(error.errors).map((e) => e.message),
      })
    }

    res.status(500).json({
      success: false,
      message: "Error updating bank details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

async function submitForApproval(req, res) {
  try {
    const { id } = req.params
    const vendor = await Vendor.findById(id)
    console.log("Submitting registration for vendor ID:", id)
    console.log("Vendor details:", vendor)
    const allCompleted = Array.from(vendor.formProgress.completedSteps.values()).every((val) => val === true)

    if (!allCompleted) {
      return res.status(400).json({
        success: false,
        message: "Please complete all sections before submitting",
      })
    }

    if (!vendor.documents.aadharFront || !vendor.documents.panCardFront || !vendor.documents.shopCertificate) {
      return res.status(400).json({
        success: false,
        message: "Please upload all required documents (Aadhar Front, PAN Card Front, and Shop Certificate)",
      })
    }

    vendor.registrationStatus = "Pending"
    vendor.submittedAt = new Date()
    await vendor.save()

    res.status(200).json({
      success: true,
      message: "Registration submitted for admin approval",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error submitting registration",
      error: error.message,
    })
  }
}

async function checkApprovalStatus(req, res) {
  try {
    const vendor = await Vendor.findById(req.user._id).select("registrationStatus adminNotes submittedAt approvedAt")

    res.status(200).json({
      success: true,
      status: vendor.registrationStatus,
      adminNotes: vendor.adminNotes,
      submittedAt: vendor.submittedAt,
      approvedAt: vendor.approvedAt,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking approval status",
      error: error.message,
    })
  }
}

// Admin Endpoints
// async function getPendingRegistrations(req, res) {
//   try {
//     const pendingVendors = await Vendor.find({ registrationStatus: 'Pending' }).lean();

//     console.log("pendingVendors", pendingVendors)

//     // Map through vendors to ensure status structure is consistent
//     const formattedVendors = pendingVendors.map(vendor => {
//       return {
//         ...vendor,
//         status: {
//           adminApproved: vendor.status?.adminApproved || false,
//           isActive: vendor.status?.isActive || false,
//           isVerified: vendor.status?.isVerified || false
//         }
//       };
//     });

//     res.status(200).json({
//       success: true,
//       count: formattedVendors.length,
//       vendors: formattedVendors
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error fetching pending registrations",
//       error: error.message
//     });
//   }
// };

async function getPendingRegistrations(req, res) {
  try {
    const pendingVendors = await Vendor.find({
      registrationStatus: "Pending",
      $or: [{ "status.adminApproved": false }, { "status.isActive": false }, { "status.isVerified": false }],
    }).lean()

    res.status(200).json({
      success: true,
      count: pendingVendors.length,
      vendors: pendingVendors,
    })
  } catch (error) {
    console.error("Error fetching pending registrations:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching pending registrations",
      error: error.message,
    })
  }
}

async function getDealerDetails(req, res) {
  try {
    const vendor = await Vendor.findById(req.params.id).select("-password -otp -otpExpiry")

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      })
    }

    res.status(200).json({
      success: true,
      vendor,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching vendor details",
      error: error.message,
    })
  }
}

async function verifyDocument(req, res) {
  try {
    const { id } = req.params
    const { docType, status } = req.body

    const validDocTypes = ["aadharFront", "aadharBack", "pan", "shop", "face"]
    if (!validDocTypes.includes(docType)) {
      return res.status(400).json({ success: false, message: "Invalid document type" })
    }

    // Map frontend docType to the documentVerification field
    const fieldMap = {
      aadharFront: "documentVerification.aadharFront",
      aadharBack: "documentVerification.aadharBack",
      pan: "documentVerification.pan",
      shop: "documentVerification.shop",
      face: "documentVerification.face",
    }

    const vendor = await Vendor.findByIdAndUpdate(
      id,
      { [fieldMap[docType]]: status },
      { new: true }
    ).select("documentVerification")

    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" })
    }

    res.status(200).json({
      success: true,
      message: `Document ${status ? "approved" : "rejected"} successfully`,
      documentVerification: vendor.documentVerification,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating document status", error: error.message })
  }
}

async function approveDealer(req, res) {
  try {
    console.log("Id:- ", req.params.id)

    // First check if vendor exists
    const vendorExists = await Vendor.findById(req.params.id)
    if (!vendorExists) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      })
    }

    // Then try to update
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      {
        registrationStatus: "Approved",
        approvedAt: new Date(),
        isActive: true,
        "status.adminApproved": true,
        "status.isActive": true,
        "status.isVerified": true,
      },
      { new: true },
    )

    res.status(200).json({
      success: true,
      message: "Vendor approved successfully",
      data: {
        vendor,
        status: {
          adminApproved: true,
          isActive: true,
          isVerified: true,
        },
      },
    })
  } catch (error) {
    console.error("Full error:", error) // Log the complete error
    res.status(500).json({
      success: false,
      message: "Error approving vendor",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
}

// async function rejectDealer(req, res) {
//   try {
//     const { notes } = req.body;

//     const vendor = await Vendor.findByIdAndUpdate(
//       req.params.id,
//       {
//         registrationStatus: 'Rejected',
//         adminNotes: notes,
//         isActive: false,
//         'status.adminApproved': false,
//         'status.isActive': false,
//       },
//       { new: true }
//     );

//     // Send rejection notification
//     await sendRejectionEmail(vendor, notes);

//     res.status(200).json({
//       success: true,
//       message: "Vendor rejected successfully",
//       data: {
//         status: {
//           adminApproved: false,
//           isActive: false,
//           isVerified: vendor.isVerify
//         }
//       }
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error rejecting vendor",
//       error: error.message
//     });
//   }
// };

async function rejectDealer(req, res) {
  try {
    const { notes } = req.body

    // Find the vendor first
    const vendor = await Vendor.findById(req.params.id)

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      })
    }

    // Send rejection email BEFORE deletion
    await sendRejectionEmail(vendor, notes)

    // Delete vendor after rejection
    await Vendor.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      message: "Vendor rejected and deleted successfully",
      data: {
        vendorId: req.params.id,
        deleted: true,
      },
    })
  } catch (error) {
    console.error("Reject dealer error:", error)

    res.status(500).json({
      success: false,
      message: "Error rejecting vendor",
      error: error.message,
    })
  }
}

function getStepNumber(section) {
  const stepMap = {
    basicInfo: 1,
    locationInfo: 2,
    shopDetails: 3,
    documents: 4,
    bankDetails: 5,
  }
  return stepMap[section]
}

function getNextStepAfter(section) {
  const stepsOrder = ["basicInfo", "locationInfo", "shopDetails", "documents", "bankDetails"]
  const currentIndex = stepsOrder.indexOf(section)
  return currentIndex < stepsOrder.length - 1 ? getStepNumber(stepsOrder[currentIndex + 1]) : 5
}

// async function notifyAdmin(vendorId) {
//   const admins = await Admin.find({ role: 'admin' }).select("email");
//   const adminEmails = admins.map(admin => admin.email);

//   await sendEmail({
//     to: adminEmails,
//     subject: 'New Vendor Registration Requires Approval',
//     html: `<p>A new vendor registration requires your approval.
//            <a href="${process.env.ADMIN_PORTAL_URL}/vendors/${vendorId}">Review now</a></p>`
//   });
// }

async function sendRejectionEmail(vendor, notes) {
  const emailAddress = vendor.personalEmail
  const name = vendor.ownerName || "Vendor"
  const message = `Your vendor registration has been rejected.\n\nAdmin Notes: ${notes || "No additional notes provided."}`
  const subject = "Your Vendor Registration Status - Rejected"

  // Using type 4 which allows custom subject and message
  await sendemails(emailAddress, name, message, 4, subject)
}

module.exports = {
  usersignin,
  sendOtp,
  verifyOTP,
  logout,
  changePassword,
  resendOtp,
  getProgress,
  updateProgress,
  updateBasicInfo,
  updateLocationInfo,
  updateShopDetails,
  uploadDocuments,
  updateBankDetails,
  submitForApproval,
  checkApprovalStatus,
  getPendingRegistrations,
  getDealerDetails,
  approveDealer,
  rejectDealer,
  verifyDocument,
}
