const service = require("../models/service_model");
const offer = require('../models/offer_model'); 
const jwt_decode = require("jwt-decode");
const Role = require('../models/Roles_modal')
const Admin = require('../models/admin_model')
const adminservices = require("../models/adminService");


async function checkPermission(user_id, requiredPermission) {
    try {
        const userRole = await Role.findOne({ subAdmin: user_id });
        console.log(userRole,"1")
        if (!userRole) {
            return false;
        }
        const permissions = userRole.permissions;
        console.log(permissions,"2")
  
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
  
// async function addoffer(req, res) {
//     try {

//         const data = jwt_decode(req.headers.token);
//         const user_id = data.user_id;
//         const user_type = data.user_type;
//         const type = data.type;
//         if (user_id == null || user_type != 1 && user_type != 3) {
//             var response = {
//                 status: 401,
//                 message: 'User is un-authorised !'

//             };
//             return res.status(401).send(response);
//         }

//         if (req.body.promo_code != '') {
//             var promo_codeCheck = await offer.findOne({ promo_code: req.body.promo_code });
            
// 			const services = await service.findById(req.body.service_id);

//             if (!promo_codeCheck) {
//                 const data = {
//                     service_id: req.body.service_id,
//                     promo_code: req.body.promo_code,
// 					// city:services.city,
//                     start_date: req.body.start_date,
//                     end_date: req.body.end_date,
//                     // noofuses: req.body.noofuses,
//                     discount: req.body.discount,
//                     minorderamt: req.body.minorderamt,
//                 };
//                 const promoResposnse = await offer.create(data);
//                 if (promoResposnse) {
//                    var response = {
//                         status: 200,
//                         message: 'Offer Added successfully',
//                         data: promoResposnse,
//                     };
//                     return res.status(200).send(response);
                    
//                 } else {
//                     var response = {
//                         status: 201,
//                         message: 'Offer Added failed',

//                     };
//                     return res.status(201).send(response);
//                 }

//             } else {
//                 var response = {
//                     status: 201,
//                     message: 'Promo code already exist',
//                 };
//                 return res.status(201).send(response);
//             }
//         } else {
//             var response = {
//                 status: 201,
//                 message: 'Promo code not be empty!',
//             };

//             return res.status(201).send(response);
//         }
//     } catch (error) {
//         console.log("error", error);
//         response = {
//             status: 201,
//             message: 'Operation was not successful',
//         };

//         return res.status(201).send(response);
//     }
// } 

async function Singleoffer(req, res) {
    try {

        const data = jwt_decode(req.headers.token);
        const user_id = data.user_id;
        const user_type = data.user_type;
        if (user_id == null || user_type != 1 && user_type != 2 && user_type != 3 && user_type != 4) {
            var response = {
                status: 401,
                message:  'offer is un-authorised !'

            };
            return res.status(401).send(response);
        }

        var offerResposnse = await offer.findById(req.params.id);
        if (offerResposnse) {
            var response = {
              status: 200,
              message: "successfull",
              data: offerResposnse,
              image_base_url: process.env.BASE_URL,
            };
            return res.status(200).send(response);
          } else {
            var response = {
              status: 201,
              offerResposnse,
              message: "No PromoCode Found",
            };
            return res.status(201).send(response);
          }

    } catch (error) {
        console.log("error", error);
        response = {
            status: 201,
            message: 'Operation was not successful',
        };

        return res.status(201).send(response);
    }
}


async function deleteoffer(req, res) {
    try {
        const data = jwt_decode(req.headers.token);
        const user_id = data.user_id;
        const user_type = data.user_type;
        const type = data.type;
        if (user_id == null || user_type != 1) {
         
            if(user_type === 3){
            const subAdmin = await Admin.findById(user_id)
            
            if (!subAdmin) {
              var response = {
                status: 401,
                message: "Subadmin not found!",
              };
              return res.status(401).send(response);
            }
      
            if(user_type === 3){
              const subAdmin = await Admin.findById(user_id)
              
              if (!subAdmin) {
                var response = {
                  status: 401,
                  message: "Subadmin not found!",
                };
                return res.status(401).send(response);
              }
            }
        
            const isAllowed = await checkPermission(user_id, "Offers.delete");
      
            if (!isAllowed) {
              var response = {
                status: 401,
                message: "Subadmin does not have permission to add Offers!",
              };
              return res.status(401).send(response);
            }
      
          }
      
        }
        const { offer_id } = req.body;
        //console.log('offer_id: ', offer_id);
        const offerRes = await offer.findOne({ _id: offer_id });
        if (offerRes) {
            offer.findByIdAndDelete({ _id: offer_id },
                async function (err, docs) {
                    if (err) {
                        var response = {
                            status: 201,
                            message: 'offer delete failed'
                        };
                        return res.status(201).send(response);
                    }
                    else {
                       
                        var response = {
                            status: 200,
                            message: 'offer deleted successfully',
                        };
                        return res.status(200).send(response);
                    }
                });
        } else {
            var response = {
                status: 201,
                message: 'offer not Available',
            };

            return res.status(201).send(response);
        }
    } catch (error) {
        console.log("error", error);
        response = {
            status: 201,
            message: 'Operation was not successful',
        };
        return res.status(201).send(response);
    }
}


async function editoffer(req, res) {
    try {
        const data = jwt_decode(req.headers.token);
        const user_id = data.user_id;
        const user_type = data.user_type;
        const type = data.type;
        if (user_id == null || user_type != 1) {
         
            if(user_type === 3){
            const subAdmin = await Admin.findById(user_id)
            
            if (!subAdmin) {
              var response = {
                status: 401,
                message: "Subadmin not found!",
              };
              return res.status(401).send(response);
            }
      
            if(user_type === 3){
              const subAdmin = await Admin.findById(user_id)
              
              if (!subAdmin) {
                var response = {
                  status: 401,
                  message: "Subadmin not found!",
                };
                return res.status(401).send(response);
              }
            }
        
            const isAllowed = await checkPermission(user_id, "Offers.update");
      
            if (!isAllowed) {
              var response = {
                status: 401,
                message: "Subadmin does not have permission to add Offers!",
              };
              return res.status(401).send(response);
            }
      
          }
      
        }
    
        const offerResp = await offer.findOne({ _id: req.params.id });
       
        if (offerResp) {
            const data = {
                    promo_code: req.body.promo_code,
                    start_date: req.body.start_date,
                    city:req.body.city,
                    end_date: req.body.end_date,
                    discount: req.body.discount,
                    minorderamt: req.body.minorderamt,
                };
            offer.findByIdAndUpdate({ _id: req.params.id },
                { $set: data },
                { new: true },
                async function (err, docs) {
                    if (err) {
                        var response = {
                            status: 201,
                            message: err,
                        };
                        return res.status(201).send(response);
                    }
                    else {
                        var response = {
                            status: 200,
                            message: 'offer updated successfully',
                            data: docs,
                        };
                        return res.status(200).send(response);
                    }
                });
        } else {
            response = {
                status: 201,
                 message: 'offer not available',
            };
            return res.status(201).send(response);
        }
    } catch (error) {
        console.log("error", error);
        response = {
            status: 201,
            message: 'Operation was not successful',
        };
        return res.status(201).send(response);
    }
}


async function applyPromoCode(req, res) {
    try {
        const { promo_code, service_id, order_amount } = req.body;

        if (!promo_code || !service_id || !order_amount) {
            return res.status(400).send({
                status: false,
                message: "promo_code, service_id, and order_amount are required"
            });
        }

        const offerData = await offer.findOne({
            promo_code: promo_code,
            service_id: service_id,
            start_date: { $lte: new Date() },
            end_date: { $gte: new Date() }
        });

        if (!offerData) {
            return res.status(404).send({
                status: false,
                message: "Promo code is invalid or expired"
            });
        }

        if (order_amount < offerData.minorderamt) {
            return res.status(400).send({
                status: false,
                message: `Minimum order amount must be ${offerData.minorderamt}`
            });
        }

        const discountAmount = (order_amount * offerData.discount) / 100;
        const finalAmount = order_amount - discountAmount;

        return res.status(200).send({
            status: true,
            message: "Promo code applied successfully",
            data: {
                offer: offerData,
                discountAmount,
                finalAmount
            }
        });
    } catch (error) {
        console.error("Error in applyPromoCode:", error);
        return res.status(500).send({
            status: false,
            message: "Something went wrong"
        });
    }
}

// By Prashant  
async function offerlist(req, res) {
  try {
    const offerResponse = await offer
      .find(req.query)
      .populate({ path: "service_id", select: ["name", "image", "description"] })
      .sort({ _id: -1 });

    if (offerResponse && offerResponse.length > 0) {
      return res.status(200).send({
        status: 200,
        message: "Successful",
        data: offerResponse,
        image_base_url: process.env.BASE_URL,
      });
    } else {
      return res.status(200).send({
        status: 200,
        message: "No PromoCode Found",
        data: [],
      });
    }
  } catch (error) {
    console.error("Error in offerlist:", error);
    return res.status(500).send({
      status: 500,
      message: "Operation was not successful",
    });
  }
}

async function addoffer(req, res) {
  try {
    // Optional: Validate required fields
    const { promo_code, service_id, start_date, end_date, discount, minorderamt } = req.body;

    if (!promo_code || promo_code.trim() === '') {
      return res.status(400).send({
        status: 400,
        message: 'Promo code must not be empty!',
      });
    }

    if (!service_id) {
      return res.status(400).send({
        status: 400,
        message: 'Service ID is required!',
      });
    }

    const promo_codeCheck = await offer.findOne({ promo_code: promo_code });
    
    if (promo_codeCheck) {
      return res.status(409).send({
        status: 409,
        message: 'Promo code already exists',
      });
    }

    // Check if service_id is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    let serviceDetails = null;
    let serviceType = "AdminService"; // default
    
    if (mongoose.Types.ObjectId.isValid(service_id)) {
      // Check in adminservices model first
      serviceDetails = await adminservices.findById(service_id);
      if (serviceDetails) {
        serviceType = "AdminService";
      }
      
      // If not found in adminservices, check in BaseService
      if (!serviceDetails) {
        const BaseService = require("../models/baseService");
        serviceDetails = await BaseService.findById(service_id);
        if (serviceDetails) {
          serviceType = "BaseService";
        }
      }
      
      // If not found in base services, check in base additional services
      if (!serviceDetails) {
        const BaseAdditionalService = require("../models/baseAdditionalServiceSchema");
        serviceDetails = await BaseAdditionalService.findById(service_id);
        if (serviceDetails) {
          serviceType = "BaseAdditionalService";
        }
      }
    }

    if (!serviceDetails) {
      return res.status(404).send({
        status: 404,
        message: 'Service not found!',
      });
    }

    // Create the offer with service_type
    const newOffer = {
      service_id,
      service_type: serviceType,
      promo_code,
      start_date,
      end_date,
      discount,
      minorderamt,
    };

    const offerResponse = await offer.create(newOffer);

    return res.status(200).send({
      status: 200,
      message: 'Offer added successfully',
      data: offerResponse,
    });

  } catch (error) {
    console.error("Error adding offer:", error);
    return res.status(500).send({
      status: 500,
      message: 'An unexpected error occurred while adding the offer.',
    });
  }
}

module.exports = {
    addoffer,
    offerlist,
    deleteoffer,
    editoffer,
    Singleoffer,
    applyPromoCode
}

