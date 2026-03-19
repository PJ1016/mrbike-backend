const service = require("../models/additionalOptionsModel");
const jwt_decode = require("jwt-decode");


// async function addAdditionalOption(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;
//     const user_type = data.user_type;
//     const type = data.type;
//     if (user_id == null || user_type != 1 && user_type != 3) {
//       var response = {
//         status: 401,
//         message: "admin is un-authorised !",
//       };
//       return res.status(401).send(response);
//     }

//     const { name, cost } = req.body;

//     if (req.file) {
//       const data =
//       {
//         image: req.file.filename,
//         name: name,
//         cost: cost,
//       };

//       const additionaloptionsResponse = await additionaloptions.create(data);

//       if (additionaloptionsResponse) {
//         var response = {
//           status: 200,
//           message: "Additional options added successfully",
//           data: additionaloptionsResponse,
//           // image_base_url: process.env.BASE_URL,
//         };
//         return res.status(200).send(response);
//       } else {
//         var response = {
//           status: 201,
//           message: "Unable to add additional",
//         };
//         return res.status(201).send(response);
//       }
//     } else {
//       var response = {
//         status: 201,
//         message: "please upload additional image",
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


// async function updateAdditional(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;
//     const user_type = data.user_type;
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
//     const { name, cost } = req.body;

//     if (req.params.id != "") {
//       const additionaldata = await additionaloptions.findById(req.params.id);

//       if (additionaldata) {
//         // Check if req.file exists
//         const imageData = req.file ? { image: req.file.filename } : {};
//         const data = {
//           ...imageData,
//           name: name,
//           cost: cost,
//         };

//         additionaloptions.findByIdAndUpdate(
//           { _id: req.params.id },
//           { $set: data },
//           { new: true },
//           async function (err, docs) {
//             if (err) {
//               var response = {
//                 status: 201,
//                 message: err,
//               };
//               return res.status(201).send(response);
//             } else {
//               var response = {
//                 status: 200,
//                 message: "additional updated successfully",
//                 data: docs,
//               };
//               return res.status(200).send(response);
//             }
//           }
//         );
//       } else {
//         var response = {
//           status: 201,
//           message: "Unable to update additional",
//         };
//         return res.status(201).send(response);
//       }
//     } else {
//       var response = {
//         status: 201,
//         message: "Can not be empty value!",
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


// async function additionalList(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;
//     const user_type = data.user_type;
//     const type = data.type;
//     // if (user_id == null || user_type != 1 && user_type != 3 && user_type != 4) {
//     //   var response = {
//     //     status: 401,
//     //     message: "admin is un-authorised !",
//     //   };
//     //   return res.status(401).send(response);
//     // }
    
//     // var additionaloptionResposnse = await additionaloptions.find().sort({ "_id": -1 });
//     var additionaloptionResposnse = await additionaloptions.find();

//     var response = {
//       status: 200,
//       message: "success",
//       data: additionaloptionResposnse,
//       // image_base_url: process.env.BASE_URL,
//     };
//     return res.status(200).send(response);
//   } catch (error) {
//     console.log("error", error);
//     response = {
//       status: 201,
//       message: "Operation was not successful",
//     };

//     return res.status(201).send(response);
//   }
// }


// async function deleteAdditional(req, res) {
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

//     var { additional_id } = req.body;
//     const additionaloptionsDel = await additionaloptions.findOne({
//       _id: additional_id,
//     });
//     if (additionaloptionsDel) {
//       additionaloptions.findByIdAndDelete(
//         { _id: additional_id },
//         async function (err, docs) {
//           if (err) {
//             var response = {
//               status: 201,
//               message: "additional options delete failed",
//             };
//             return res.status(201).send(response);
//           } else {
//             var response = {
//               status: 200,
//               message: "additional options deleted successfully",
//             };
//             return res.status(200).send(response);
//           }
//         }
//       );
//     } else {
//       var response = {
//         status: 201,
//         message: "additonal options not Available",
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

// async function Getadditional(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;
//     const user_type = data.user_type;
//     const type = data.type;
//     // if (user_id == null || user_type != 1 && user_type != 3 && user_type != 4) {
//     //   var response = {
//     //     status: 401,
//     //     message: "admin is un-authorised !",
//     //   };
//     //   return res.status(401).send(response);
//     // }
    
//     // var additionaloptionResposnse = await additionaloptions.find().sort({ "_id": -1 });
//     var additionaloptionResposnse = await additionaloptions.findById(req.params.id);

//     var response = {
//       status: 200,
//       message: "success",
//       data: additionaloptionResposnse,
//       // image_base_url: process.env.BASE_URL,
//     };
//     return res.status(200).send(response);
//   } catch (error) {
//     console.log("error", error);
//     response = {
//       status: 201,
//       message: "Operation was not successful",
//     };

//     return res.status(201).send(response);
//   }
// }




// module.exports = {
//   addAdditionalOption,
//   additionalList,
//   updateAdditional,
//   deleteAdditional,
//   Getadditional,
// };


async function servicelist(req, res) {
  try {
    const services = await service
      .find()
      .populate("dealer_id", "name email")
      .sort({ id: -1 });

    return res.status(200).send({
      status: 200,
      message: services.length > 0 ? "Success" : "No services available",
      data: services,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    return res.status(200).send({ status: 500, message: "Internal Server Error" });
  }
}

async function singleService(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(200).send({ status: 400, message: "Service ID is required!" });
    }

    const serviceData = await service.findById(id).populate("dealer_id", "name email");
    return res.status(200).send({
      status: 200,
      message: serviceData ? "Success" : "Service not found!",
      data: serviceData || {},
    });
  } catch (error) {
    console.error("Error fetching service:", error);
    return res.status(200).send({ status: 500, message: "Internal Server Error" });
  }
}

async function updateService(req, res) {
  try {
    const { service_id, name, description, dealer_id, bikes } = req.body;
    if (!service_id || !name || !dealer_id) {
      return res.status(200).send({ status: 400, message: "Service ID, name, and dealer ID are required!" });
    }

    let parsedBikes = [];
    if (bikes) {
      try {
        parsedBikes = JSON.parse(bikes);
      } catch (error) {
        return res.status(200).send({ status: 400, message: "Invalid bikes data format!" });
      }
    }

    const updateData = { name, description, dealer_id };
    if (req.file) {
      updateData.image = req.file.location; // S3 URL
    }
    if (parsedBikes.length > 0) {
      updateData.bikes = parsedBikes;
    }

    const updatedService = await service.findByIdAndUpdate(service_id, updateData, { new: true });
    return res.status(200).send({
      status: 200,
      message: updatedService ? "Service updated successfully" : "Service not found!",
      data: updatedService || {},
    });
  } catch (error) {
    console.error("Error updating service:", error);
    return res.status(200).send({ status: 500, message: "Internal Server Error" });
  }
}

async function deleteService(req, res) {
  try {
    const { service_id } = req.body;
    if (!service_id) {
      return res.status(200).send({ status: 400, message: "Service ID is required!" });
    }

    const deletedService = await service.findByIdAndDelete(service_id);
    return res.status(200).send({
      status: 200,
      message: deletedService ? "Service deleted successfully" : "Service not found!",
    });
  } catch (error) {
    console.error("Error deleting service:", error);
    return res.status(200).send({ status: 500, message: "Internal Server Error" });
  }
}

async function getServicesByDealer(req, res) {
  try {
    const { dealer_id } = req.params;

    if (!dealer_id) {
      return res.status(200).send({ status: 400, message: "Dealer ID is required!" });
    }

    const services = await service.find({ dealer_id }).populate("dealer_id", "name email");

    return res.status(200).send({
      status: 200,
      message: services.length > 0 ? "Success" : "No services found for this dealer",
      data: services,
    });
  } catch (error) {
    console.error("Error fetching services by dealer:", error);
    return res.status(200).send({ status: 500, message: "Internal Server Error" });
  }
}

async function addservice(req, res) {
  try {
    const { name, description, dealer_id, bikes } = req.body;

    if (!req.file || !name || !dealer_id) {
      return res.status(200).send({
        status: 400,
        message: "Name, image, and dealer ID are required!",
      });
    }

    let parsedBikes = [];
    try {
      parsedBikes = JSON.parse(bikes);
    } catch (error) {
      return res.status(200).send({
        status: 400,
        message: "Invalid bikes data format!",
      });
    }

    const newService = await service.create({
      name,
      image: req.file.location, // S3 URL
      description,
      dealer_id,
      bikes: parsedBikes,
    });

    return res.status(200).send({
      status: 200,
      message: "Service added successfully",
      data: newService,
    });
  } catch (error) {
    console.error("Error adding service:", error);
    return res.status(200).send({
      status: 500,
      message: "Internal Server Error",
    });
  }
}

module.exports = {
  addservice,
  servicelist,
  singleService,
  updateService,
  deleteService,
  getServicesByDealer,
};