const mongoose = require('mongoose');
const booking = require("../models/Booking");
const additionaloptions = require("../models/additionalOptionsModel");
const AdditionalService = require("../models/additionalServiceSchema");
const service = require("../models/service_model");
const bike = require("../models/bikeModel");
const Tracking = require("../models/Tracking");
const jwt_decode = require("jwt-decode");
const customers = require("../models/customer_model");
const Dealer = require("../models/Dealer");
const Role = require('../models/Roles_modal')
const Admin = require('../models/admin_model')
const { Notification } = require("../helper/pushNotification");
const { handleBookingCompletion } = require("../controller/reward")

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

async function addbooking(req, res) {


  try {

    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || user_type != 1 && user_type != 4) {
      var response = {
        status: 401,
        message: "admin is un-authorised !",
      };
      return res.status(401).send(response);
    }

    const customer = await customers.findById(user_id);

    // let services = await service.findById(req.params.id)
    // let services = await service.findById(req.params.id)
    const servicelist = req.body.Servicelist;
    const dealerIdToCheck = servicelist[0]?.dealerId;


    if (!servicelist.every(service => service.dealerId === dealerIdToCheck)) {
      return res.status(400).json({ message: 'All dealerId should be from the same dealer.' });
    }


    // const serviceIds = servicelist.map(service => service._id);
    // console.log(serviceIds);

    // // Check if any of the services do not exist
    // const nonExistingServices = await service.find({ _id: { $nin: serviceIds } });

    // if (nonExistingServices.length > 0) {
    //   console.log(`Services not found for IDs:`);
    //   const nonExistingServiceIds = nonExistingServices.map(service => service._id.toString());
    //   res.status(400).json({ error: `Services not found for IDs: ${nonExistingServiceIds.join(', ')}` });
    //   return;
    // }


    // if (!services) {
    //   res.status(201).json({ error: "No Service exists" })
    //   return;
    // }

    const { bullet_points, additonal_options, bike_id, area, city, address, description, estimated_cost, Servicelist, additonal_data_moveable } = req.body;

    let bikes = await bike.findById(bike_id)
    if (!bikes) {
      res.status(201).json({ error: "No Bike Found" })
      return;
    }

    const dealers = await Dealer.find({ id: req.params.id }).exec();

    const timeout = 3 * 60 * 1000;
    // const timeout = 20 * 1000;

    // console.log(dealers);

    if (additonal_options) {
      let extra_charges = 0;
      let count = 0;
      let size = additonal_options.length

      if (size > 0) {
        await additonal_options.forEach(data => {
          additionaloptions.find({ name: data }, async (err, datas) => {
            extra_charges += datas[0].cost
            count++
            //console.log(extra_charges);
            if (count == size) {
              const data = {
                // service_id: services._id,
                services: Servicelist,
                bullet_points: bullet_points,
                additonal_options: additonal_options,
                model: bikes.model,
                brand: bikes.name,
                bike_charge: bikes.extra_charges,
                area: area.toLowerCase(),
                city: city.toLowerCase(),
                address: address,
                description: description,
                estimated_cost: estimated_cost,
                created_by: user_id,
                assigned_to: dealers[0].name,
                assigned_toid: dealers[0].id,
                extra_charges: dealers[0].extra_charges,
                dealer_shop_name: dealers[0].shop,
                additonal_data_moveable: additonal_data_moveable,
              };

              const bookingresponce = await booking.create(data);



              if (bookingresponce) {

                // Add booking for tracking
                const datas = {
                  // service_id: services._id,
                  services: Servicelist,
                  booking_id: bookingresponce._id,
                  user_id: user_id,
                  users_id: customer?.id
                }
                const traking = await Tracking.create(datas)
                setTimeout(async () => {
                  const updatedBooking = await booking.findById(bookingresponce._id);

                  if (updatedBooking && updatedBooking.status === 'pending') {
                    await booking.findByIdAndUpdate(bookingresponce._id, { status: 'rejected' });
                    await Tracking.updateOne({ _id: traking._id }, { $set: { status: 'rejected' } });
                    Notification(customer.device_token, `Sorry ${customer.name},our Provider is buzzy now, Booking is canceled for ${bikes?.name} ${bikes?.model} ${bikes?.bike_cc} Bike`, customer.id)
                    console.log(`Booking ${bookingresponce._id} automatically rejected after 3 minutes.`);
                  }
                  // console.log({message : "booking 1111111111",traking,customer,});
                  // Notification(dealers[0].device_token, `Hi ${dealers.name}, New Booking is Arrived for ${bikes?.name} ${bikes?.model} ${bikes?.bike_cc} Bike`)
                }, timeout);

                // send Push notification to  nearer dealer 
                if (dealers) {
                  Notification(dealers[0].device_token, `Hi ${data.name}, New Booking is Arrived for ${bikes?.name} ${bikes?.model} ${bikes?.bike_cc} Bike`, dealers[0].id)
                }

                var response = {
                  status: 200,
                  message: "User Booking successfull",
                  data: bookingresponce,
                  image_base_url: process.env.BASE_URL,
                };
                return res.status(200).send(response);
              } else {
                var response = {
                  status: 201,
                  message: "Unable to add Booking",
                };
                return res.status(201).send(response);
              }
            }
          })
        })
      } else {
        const data = {
          // service_id: services._id,
          services: Servicelist,
          bullet_points: bullet_points,
          additonal_options: additonal_options,
          model: bikes.model,
          brand: bikes.name,
          bike_charge: bikes.extra_charges,
          area: area.toLowerCase(),
          city: city.toLowerCase(),
          address: address,
          description: description,
          estimated_cost: estimated_cost,
          created_by: user_id,
          assigned_to: dealers[0].name,
          assigned_toid: dealers[0].id,
          extra_charges: dealers[0].extra_charges,
          dealer_shop_name: dealers[0].shop,
          additonal_data_moveable,
        };
        const bookingresponce = await booking.create(data);

        if (bookingresponce) {

          // Add booking for tracking
          const datas = {
            // service_id: services._id,
            services: Servicelist,
            booking_id: bookingresponce._id,
            user_id: user_id,
            users_id: customer?.id
          }
          const traking = await Tracking.create(datas)
          setTimeout(async () => {
            const updatedBooking = await booking.findById(bookingresponce._id);

            if (updatedBooking && updatedBooking.status === 'pending') {
              await booking.findByIdAndUpdate(bookingresponce._id, { status: 'rejected' });
              await Tracking.updateOne({ _id: traking._id }, { $set: { status: 'rejected' } });
              Notification(customer.device_token, `Sorry ${customer.name},our Provider is buzzy now, Booking is canceled for ${bikes?.name} ${bikes?.model} ${bikes?.bike_cc} Bike`, customer.id)
              console.log(`Booking ${bookingresponce._id} automatically rejected after 3 minutes.`);
            }
            // console.log({message : "booking 2222222",traking,customer,});
          }, timeout);


          console.log("dealers11", dealers);

          // send Push notification to  nearer dealer 
          if (dealers) {
            Notification(dealers[0].device_token, `Hi ${dealers.name}, New Booking is Arrived for ${bikes?.name} ${bikes?.model} ${bikes?.bike_cc} Bike`, dealers[0].id)
            // dealers.map((data, index) => {
            // })
          }


          var response = {
            status: 200,
            message: "User Booking successfull",
            data: bookingresponce,
            image_base_url: process.env.BASE_URL,
          };
          return res.status(200).send(response);
        } else {
          var response = {
            status: 201,
            message: "Unable to add Booking",
          };
          return res.status(201).send(response);
        }
      }
    }
    else {
      const data = {
        // service_id: services._id,
        services: Servicelist,
        bullet_points: bullet_points,
        //additonal_options:additonal_options,
        model: bikes.model,
        brand: bikes.name,
        bike_charge: bikes.extra_charges,
        area: area.toLowerCase(),
        city: city.toLowerCase(),
        address: address,
        description: description,
        estimated_cost: estimated_cost,
        created_by: user_id,
        assigned_to: dealers[0].name,
        assigned_toid: dealers[0].id,
        extra_charges: dealers[0].extra_charges,
        dealer_shop_name: dealers[0].shop,
        additonal_data_moveable,
      };
      const bookingresponce = await booking.create(data);


      if (bookingresponce) {

        // Add booking for tracking
        const datas = {
          // service_id: services._id,
          services: Servicelist,
          booking_id: bookingresponce._id,
          user_id: user_id,
          users_id: customer?.id
        }
        const traking = await Tracking.create(datas)
        setTimeout(async () => {
          const updatedBooking = await booking.findById(bookingresponce._id);

          if (updatedBooking && updatedBooking.status === 'pending') {
            await booking.findByIdAndUpdate(bookingresponce._id, { status: 'rejected' });
            await Tracking.updateOne({ _id: traking._id }, { $set: { status: 'rejected' } });
            Notification(customer.device_token, `Sorry ${customer.name},our Provider is buzzy now, Booking is canceled for ${bikes?.name} ${bikes?.model} ${bikes?.bike_cc} Bike`, customer.id)
            console.log(`Booking ${bookingresponce._id} automatically rejected after 3 minutes.`);
          }
          // console.log({message : "booking 3333333",traking,customer,});
        }, timeout);

        console.log("dealers2", dealers);
        console.log("dealername", dealers[0].name);
        const testt = "c9HJP6A2RLqjGzHjemYT6Z:APA91bFrGTGQnL0OdQpcv-8lTJWtlVan7E54ofXhGuUB2Hz2wMwMQ5hq18PQeP8AAS1T1ilNQ3HFI72dBTFMbdT9ts8FJHR0CNYORYQ4sY7RW4HBLo6eInezbEwCyFlDv2LBDZ-uR1GS"


        // send Push notification to  nearer dealer 
        if (dealers) {
          Notification(dealers[0].device_token, `Hi ${dealers[0].name}, New Booking is Arrived for ${bikes?.name} ${bikes?.model} ${bikes?.bike_cc} Bike`, dealers[0].id)
          // dealers.map((data, index) => {
          // })
        }

        var response = {
          status: 200,
          message: "User Booking successfull",
          data: bookingresponce,
          image_base_url: process.env.BASE_URL,
        };
        return res.status(200).send(response);
      } else {
        var response = {
          status: 201,
          message: "Unable to add Booking",
        };
        return res.status(201).send(response);
      }
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

async function getbooking(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || user_type != 1 && user_type != 2 && user_type != 4) {
      var response = {
        status: 401,
        message: "admin is un-authorised !",
      };
      return res.status(401).send(response);
    }

    let bookingresponce = await booking.findOne({ _id: req.params.id })
      .populate({ path: "service_id", select: ['name', 'image', 'description'] })
      .populate({ path: "created_by", select: ['first_name', 'email', 'last_name', 'phone', 'image', 'address', 'city'] })
    // .populate({path:"service_provider_id",select: ['name', 'email', 'phone']})

    if (bookingresponce) {
      var response = {
        status: 200,
        message: "successfull",
        data: bookingresponce,
        image_base_url: process.env.BASE_URL,
      };
      return res.status(200).send(response);
    } else {
      var response = {
        status: 201,
        data: [],
        message: "No bookings Found",
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

const Customer = require("../models/customer_model");
const Vendor = require("../models/dealerModel");
const UserBike = require("../models/userBikeModel");

const getuserbookings = async (req, res) => {
  try {
    const { user_id } = req.params;
    const user_type = Number(req.query.user_type);

    if (!user_id) {
      return res.status(400).json({
        status: 400,
        message: "User ID is required in URL (e.g., /api/bookings/:user_id)."
      });
    }

    if (![2, 4].includes(user_type)) {
      return res.status(400).json({
        status: 400,
        message: "Valid user_type (2 for dealer, 4 for user) is required in query params."
      });
    }

    const targetField = user_type === 2 ? "dealer_id" : "user_id";

    // Build filter: accept Mongo ObjectId or numeric auto-increment id
    const filter = {};

    if (mongoose.Types.ObjectId.isValid(user_id)) {
      filter[targetField] = mongoose.Types.ObjectId(user_id);
    } else if (/^\d+$/.test(user_id)) {
      const numericId = Number(user_id);

      if (targetField === "user_id") {
        const cust = await Customer.findOne({ id: numericId }).select("_id").lean();
        if (!cust) {
          return res.status(404).json({ status: 404, message: `Customer with numeric id ${numericId} not found.` });
        }
        filter[targetField] = cust._id;
      } else {
        const vendor = await Vendor.findOne({ id: numericId }).select("_id").lean();
        if (!vendor) {
          return res.status(404).json({ status: 404, message: `Vendor with numeric id ${numericId} not found.` });
        }
        filter[targetField] = vendor._id;
      }
    } else {
      return res.status(400).json({
        status: 400,
        message: "Provided user_id must be either a Mongo ObjectId or a numeric id."
      });
    }

    // pagination
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    // Query and populate the bike details (userBike_id) + other fields
    const [total, userBookings] = await Promise.all([
      booking.countDocuments(filter),
      booking.find(filter)
        .populate({
          path: "services",
          model: "AdminService"
        })
        .populate("additionalServices")
        .populate("dealer_id")
        .populate("pickupAndDropId")
        // populate user with optional inner population of user's bikes
        .populate({
          path: "user_id",
          // uncomment to populate user.userBike array as well:
          // populate: { path: "userBike" }
        })
        // IMPORTANT: populate the userBike referenced in booking so we get bike details
        .populate({
          path: "userBike_id",
          populate: { path: "variant_id" } // optional: populate variant inside bike
        })
        .sort({ create_date: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    if (!userBookings || userBookings.length === 0) {
      return res.status(200).json({
        status: 200,
        success: true,
        message: "No bookings found for this user",
        data: [],
        meta: { total: 0, page, limit }
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      data: userBookings,
      meta: { total, page, limit, pages: Math.ceil(total / limit) }
    });

  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


// const getuserbookings = async (req, res) => {
//   try {
//     const { user_id } = req.params;

//     const { user_type } = req.query;

//     if (!user_id) {
//       return res.status(400).json({
//         status: 400,
//         message: "User ID is required in URL (e.g., /api/bookings/123)"
//       });
//     }

//     if (!user_type || ![2, 4].includes(Number(user_type))) {
//       return res.status(400).json({
//         status: 400,
//         message: "Valid user_type (2 for dealer, 4 for user) is required in query params"
//       });
//     }

//     console.log("user_type", user_type, "user_id", user_id);

//     // Set filter based on user_type
//     let filter = {};
//     if (user_type == 2) {
//       filter = { dealer_id: user_id }; // Dealer's bookings
//     } else if (user_type == 4) {
//       filter = { user_id: user_id };   // User's bookings
//     }

//     const userBookings = await booking.find(filter)
//       .populate("services")
//       .populate("dealer_id")
//       .populate("pickupAndDropId")
//       .populate("user_id")
//       .sort({ create_date: -1 });

//     if (!userBookings?.length) {
//       return res.status(200).json({
//         status: 200,
//         success: true,
//         message: "No bookings found for this user",
//         data: userBookings
//       });
//     }

//     // Return successful response
//     res.status(200).json({
//       status: 200,
//       success: true,
//       data: userBookings
//     });

//   } catch (error) {
//     console.error("Error fetching bookings:", error);
//     res.status(500).json({
//       status: 500,
//       message: "Internal Server Error"
//     });
//   }
// };

async function deletebooking(req, res) {
  try {

    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;

    if (user_id == null || user_type != 1) {


      if (user_type === 3) {
        const subAdmin = await Admin.findById(user_id)

        if (!subAdmin) {
          var response = {
            status: 401,
            message: "Subadmin not found!",
          };
          return res.status(401).send(response);
        }

        if (user_type === 3) {
          const subAdmin = await Admin.findById(user_id)

          if (!subAdmin) {
            var response = {
              status: 401,
              message: "Subadmin not found!",
            };
            return res.status(401).send(response);
          }
        }

        const isAllowed = await checkPermission(user_id, "Booking.delete");

        if (!isAllowed) {
          var response = {
            status: 401,
            message: "Subadmin does not have permission to add Booking!",
          };
          return res.status(401).send(response);
        }

      }

    }



    const { booking_id } = req.body;
    const bookingRes = await booking.findOne({ _id: booking_id });
    if (bookingRes) {
      booking.findByIdAndDelete({ _id: booking_id }, async function (err, docs) {
        if (err) {
          var response = {
            status: 201,
            message: "Booking delete failed",
          };
          return res.status(201).send(response);
        } else {
          var response = {
            status: 200,
            message: "Booking deleted successfully",
          };
          return res.status(200).send(response);
        }
      });
    } else {
      var response = {
        status: 201,
        message: "Booking not Found",
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

async function updateBookings(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;
    const user_type = data.user_type;
    const type = data.type;
    if (user_id == null || user_type != 1 && user_type != 2 && user_type != 4) {
      var response = {
        status: 401,
        message: "Admin is un-authorised !",
      };
      return res.status(401).send(response);
    }

    const { status, dealer_id, additonal_options, estimated_cost, final_cost, additonal_data_moveable } = req.body;

    let bookings = await booking.findById(req.params.id);

    if (!bookings) {
      res.status(201).json({ status: 201, error: "No Booking Found" });
      return;
    }

    const user = await customers.findById(bookings.created_by).exec();

    if (bookings.status === status) {
      res.status(201).json({ status: 201, message: `Booking is Already ${status}` });
      return;
    }

    if (status === "completed") {
      await handleBookingCompletion(bookings);
    }

    let dealers = await Dealer.findOne({ _id: dealer_id }); // changes

    if (!dealers) {
      res.status(201).json({ status: 201, error: "No Dealer Found" });
      return;
    }

    const datas =
    {
      status: status,
      dealer_name: dealers.name,
      dealr_id: dealers.id,
      dealer_id: dealer_id,
      dealer_address: dealers.address,
      dealer_phone: dealers.phone,
      additonal_options: additonal_options,
      estimated_cost: estimated_cost,
      final_cost: final_cost,
      additonal_data_moveable,
    };

    booking.findByIdAndUpdate(
      { _id: req.params.id },
      { $set: datas },
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
          // const sphone = vendors.phone
          // const uphone = user.phone
          // const service_provider_address = docs.service_provider_address
          // const user_address = user.address

          // const data = await otpAuth.pickndropotp(sphone,uphone,service_provider_address,user_address)
          // docs.otp = data.otp

          // push notification on booking update
          if (status == "rejected") {
            Notification(user?.device_token || user?.ftoken, `Sorry ${user?.first_name} , Your Booking of ${bookings?.brand} ${bookings?.model} has been Rejected`, user?.id);
          } else {
            Notification(user?.device_token || user?.ftoken, `Hi ${user?.first_name} , Your Booking of ${bookings?.brand} ${bookings?.model} ${status} successfully`, user?.id);
          }

          var response = {
            status: 200,
            message: "Booking updated successfully",
            // data: docs,
            // image_base_url: process.env.BASE_URL,
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

// Create Booking
// async function updateBookings(req, res) {
//   try {
//     const { user_id, booking_id } = req.params;
//     const { 
//       status, 
//       dealer_id, 
//       additional_options = [], 
//       estimated_cost, 
//       final_cost, 
//       additional_data_moveable 
//     } = req.body;

//     // Validate required parameters
//     if (!user_id || !booking_id) {
//       return res.status(400).json({
//         status: 400,
//         message: "User ID and Booking ID are required in params"
//       });
//     }

//     // Find booking
//     const bookings = await booking.findById(booking_id);
//     if (!bookings) {
//       return res.status(404).json({ 
//         status: 404, 
//         message: "No Booking Found" 
//       });
//     }

//     // Verify user exists and is authorized
//     const user = await customers.findById(user_id);
//     if (!user) {
//       return res.status(401).json({
//         status: 401,
//         message: "Unauthorized - User not found"
//       });
//     }

//     // Check if status is changing
//     if (booking.status === status) {
//       return res.status(200).json({ 
//         status: 200, 
//         message: `Booking is already ${status}` 
//       });
//     }

//     // Handle completion status
//     if (status === "completed") {
//       await handleBookingCompletion(booking);

//       if (!final_cost) {
//         return res.status(400).json({
//           status: 400,
//           message: "Final cost is required for completion"
//         });
//       }
//     }

//     // Verify dealer if provided
//     let dealer = null;
//     if (dealer_id) {
//       dealer = await Dealer.findById(dealer_id);
//       if (!dealer) {
//         return res.status(404).json({ 
//           status: 404, 
//           message: "No Dealer Found" 
//         });
//       }
//     }

//     // Prepare update data
//     const updateData = {
//       status,
//       ...(dealer_id && {
//         dealer_id,
//         dealer_name: dealer?.name,
//         dealer_address: dealer?.address,
//         dealer_phone: dealer?.phone
//       }),
//       ...(additional_options && { additional_options }),
//       ...(estimated_cost && { estimated_cost }),
//       ...(final_cost && { final_cost }),
//       ...(additional_data_moveable && { additional_data_moveable })
//     };

//     // Update booking
//     const updatedBooking = await booking.findByIdAndUpdate(
//       booking_id,
//       { $set: updateData },
//       { new: true }
//     );

//     // Send notification
//     const notificationMessage = status === "rejected" 
//       ? `Sorry ${user.first_name}, your booking of ${booking.brand} ${booking.model} has been rejected`
//       : `Hi ${user.first_name}, your booking of ${booking.brand} ${booking.model} has been ${status} successfully`;

//     if (user.device_token || user.ftoken) {
//       await Notification(
//         user.device_token || user.ftoken,
//         notificationMessage,
//         user._id
//       );
//     }

//     return res.status(200).json({
//       status: 200,
//       message: "Booking updated successfully",
//       data: {
//         booking_id: updatedBooking._id,
//         status: updatedBooking.status,
//         ...(updatedBooking.final_cost && { final_cost: updatedBooking.final_cost })
//       }
//     });

//   } catch (error) {
//     console.error("Booking update error:", error);
//     return res.status(500).json({
//       status: 500,
//       message: "Internal server error",
//       error: error.message
//     });
//   }
// }

// async function createBooking(req, res) {
//   try {
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;

//     const { dealer_id, services, pickupAndDropId, userBike_id, pickupDate } = req.body;
//     if (!dealer_id || !services || services.length === 0) {
//       return res.status(400).json({ success: false, message: "Dealer and at least one service are required" });
//     }

//     const newBooking = new booking({
//       user_id,
//       dealer_id,
//       services,
//       pickupAndDropId: pickupAndDropId || null,
//       userBike_id,
//       pickupDate
//     });

//     await newBooking.save();
//     res.status(201).json({ success: true, message: "Booking created successfully", data: newBooking });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// }

// async function createBooking(req, res) {
//   try {
//     // still using token for user_id (as in your code)
//     const data = jwt_decode(req.headers.token);
//     const user_id = data.user_id;

//     const { dealer_id, services, pickupAndDropId, userBike_id, pickupDate } = req.body;

//     if (!dealer_id || !services || services.length === 0) {
//       return res.status(400).json({ success: false, message: "Dealer and at least one service are required" });
//     }
//     if (!userBike_id) {
//       return res.status(400).json({ success: false, message: "User bike is required" });
//     }

//     const otp = Math.floor(100000 + Math.random() * 900000);

//     const newBooking = new booking({
//       user_id,
//       dealer_id,
//       services,
//       pickupAndDropId: pickupAndDropId || null,
//       userBike_id,
//       pickupDate,
//       otp,
//     });

//     await newBooking.save();

//     return res.status(201).json({
//       success: true,
//       message: "Booking created successfully",
//       data: newBooking,
//       otp 
//     });

//   } catch (error) {
//     console.error("createBooking error:", error);
//     return res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// }

function genOtp() {
  return Math.floor(1000 + Math.random() * 9000);
}

async function createBooking(req, res) {
  try {
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;

    const { dealer_id, services, pickupAndDropId, userBike_id, pickupDate } = req.body;

    if (!dealer_id || !services || services.length === 0) {
      return res.status(400).json({ success: false, message: "Dealer and at least one service are required" });
    }
    if (!userBike_id) {
      return res.status(400).json({ success: false, message: "User bike is required" });
    }

    const pickupOtp = genOtp();
    const deliveryOtp = genOtp();

    const newBooking = new booking({
      user_id,
      dealer_id,
      services,
      pickupAndDropId: pickupAndDropId || null,
      userBike_id,
      pickupDate: pickupDate || null,
      pickupOtp,
      deliveryOtp,
    });

    await newBooking.save();

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: newBooking,
      pickupOtp,
      deliveryOtp,
    });
  } catch (error) {
    console.error("createBooking error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

async function getBookingDetails(req, res) {
  try {
    const bookingId = req.params.id;

    // First, verify the booking exists without population
    const bookingExists = await booking.findById(bookingId);
    if (!bookingExists) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Then populate with debug logging
    const bookings = await booking.findById(bookingId)
      .populate("user_id")
      .populate({
        path: "dealer_id",
        model: "Vendor"
      })
      .populate({
        path: "services",
        model: "AdminService"
      })
      .populate("pickupAndDropId")
      .populate("userBike_id");

    console.log("Raw populated data:", bookings);

    // Check if services array exists but is empty
    if (!bookings.services || bookings.services.length === 0) {
      console.log("No services found for booking:", bookingId);
      return res.status(200).json({
        success: true,
        data: bookings,
        message: "Booking found but no services associated"
      });
    }

    const userBikeCC = parseInt(bookings?.userBike_id?.bike_cc || 0);
    console.log("Filtering services for bike CC:", userBikeCC);

    const filteredServices = bookings.services
      .map(service => {
        const matchingBikes = service.bikes?.filter(b => b.cc === userBikeCC) || [];
        return {
          ...service.toObject(),
          bikes: matchingBikes
        };
      })
      .filter(service => service.bikes.length > 0);

    console.log("Filtered services count:", filteredServices.length);

    const result = {
      ...bookings.toObject(),
      services: filteredServices.length > 0 ? filteredServices : bookings.services
    };

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error in getBookingDetails:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

async function updateBooking(req, res) {
  try {
    const { bookingId, ...updateFields } = req.body;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID is required" });
    }

    const existingBooking = await booking.findById(bookingId);
    if (!existingBooking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // --- handle `services` specially (these are AdditionalService IDs) ---
    if (Object.prototype.hasOwnProperty.call(updateFields, "services")) {
      const services = updateFields.services;
      delete updateFields.services; // prevent generic setter from overwriting

      if (!Array.isArray(services)) {
        return res.status(400).json({
          success: false,
          message: "`services` must be an array of AdditionalService ids",
        });
      }

      // ❌ IMPORTANT: do NOT mirror into existingBooking.services
      //    That field in your schema is for core `service` model, not additionalServices.
      // existingBooking.services = services; // <-- remove this line if you had it

      if (services.length === 0) {
        existingBooking.additionalServices = [];
      } else {
        // validate ids
        const invalid = services.filter((id) => !mongoose.Types.ObjectId.isValid(id));
        if (invalid.length) {
          return res.status(400).json({
            success: false,
            message: "Invalid service id(s) provided",
            invalid,
          });
        }

        // ensure all requested AdditionalService docs exist (optional but recommended)
        const svcDocs = await AdditionalService.find({ _id: { $in: services } })
          .select("_id") // we just need to verify existence
          .lean();

        const foundIds = new Set(svcDocs.map((s) => String(s._id)));
        const missing = services.filter((id) => !foundIds.has(String(id)));
        if (missing.length) {
          return res.status(400).json({
            success: false,
            message: "Some services do not exist",
            missing,
          });
        }

        // ✅ Assign ONLY ObjectIds to match your schema
        existingBooking.additionalServices = services.map((id) => new mongoose.Types.ObjectId(id));
      }
    }

    // --- generic field updates (everything except `services`) ---
    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] !== undefined) {
        existingBooking[key] = updateFields[key];
      }
    });

    await existingBooking.save();

    // ✅ Populate the correct path for an ObjectId[] ref
    await existingBooking.populate({
      path: "additionalServices",
      select: "_id id name image description bikes",
    });

    const data = existingBooking.toObject();
    if (!Array.isArray(data.additionalServices)) data.additionalServices = [];

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update Booking Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// async function updateBooking(req, res) {
//   try {
//     const { bookingId, ...updateFields } = req.body;

//     if (!bookingId) {
//       return res.status(400).json({ success: false, message: "Booking ID is required" });
//     }

//     let existingBooking = await booking.findById(bookingId);
//     if (!existingBooking) {
//       return res.status(404).json({ success: false, message: "Booking not found" });
//     }

//     if (Object.prototype.hasOwnProperty.call(updateFields, "services")) {
//       const services = updateFields.services;      
//       delete updateFields.services;                

//       if (!Array.isArray(services)) {
//         return res.status(400).json({
//           success: false,
//           message: "`services` must be an array of AdditionalService ids",
//         });
//       }

//       existingBooking.services = services;

//       if (services.length === 0) {
//         existingBooking.additionalServices = [];
//       } else {
//         const invalid = services.filter((id) => !mongoose.Types.ObjectId.isValid(id));
//         if (invalid.length) {
//           return res.status(400).json({
//             success: false,
//             message: "Invalid service id(s) provided",
//             invalid,
//           });
//         }

//         const svcDocs = await AdditionalService.find({ _id: { $in: services } })
//           .select("_id id name image description bikes")
//           .lean();

//         const foundIds = new Set(svcDocs.map((s) => String(s._id)));
//         const missing = services.filter((id) => !foundIds.has(String(id)));
//         if (missing.length) {
//           return res.status(400).json({
//             success: false,
//             message: "Some services do not exist",
//             missing,
//           });
//         }

//         existingBooking.additionalServices = svcDocs.map((s) => ({
//           service: s._id,  
//           id: s.id,        
//           name: s.name,
//           image: s.image,
//           description: s.description,
//           bikes: s.bikes,
//         }));
//       }
//     }

//     // --- generic field updates (everything except services) ---
//     Object.keys(updateFields).forEach((key) => {
//       if (updateFields[key] !== undefined) {
//         existingBooking[key] = updateFields[key];
//       }
//     });

//     await existingBooking.save();

//     // Always include additionalServices in response
//     if (typeof existingBooking.populate === "function") {
//       await existingBooking.populate("additionalServices.service");
//     }
//     const data = existingBooking.toObject ? existingBooking.toObject() : existingBooking;
//     if (!Array.isArray(data.additionalServices)) data.additionalServices = [];

//     return res.status(200).json({
//       success: true,
//       message: "Booking updated successfully",
//       data,
//     });
//   } catch (error) {
//     console.error("Update Booking Error:", error);
//     return res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// }

async function updateBookingStatus(req, res) {
  try {
    const { bookingId } = req.params;
    const { status, user_id } = req.body;
    console.log("Booking id", bookingId)
    console.log("Status", req.body)
    if (!bookingId || !status || !user_id) {
      return res.status(400).json({
        success: false,
        message: "Booking ID, status, and user ID are required"
      });
    }

    // Find and update booking
    let existingBooking = await booking.findById(bookingId);
    if (!existingBooking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Verify the requesting user has rights to update this booking
    if (existingBooking.user_id.toString() !== user_id &&
      existingBooking.dealer_id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to update this booking"
      });
    }

    // Update status
    existingBooking.status = status;
    await existingBooking.save();

    // Handle completion logic if needed
    if (status === "completed") {
      await handleBookingCompletion(existingBooking);
    }

    // Notify customer if they're not the one making the update
    if (existingBooking.user_id.toString() !== user_id) {
      const customer = await customers.findById(existingBooking.user_id);
      if (customer?.device_token) {
        Notification(
          customer.device_token,
          `Your booking status has been updated to: ${status}`,
          customer._id.toString()
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      data: existingBooking
    });

  } catch (error) {
    console.error("Update Booking Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
}

const sendBookingOTP = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(200).json({ success: false, message: "Booking ID is required" });
    }

    // Booking aur Dealer ka data fetch karna
    const bookingData = await booking.findById(bookingId).populate("dealer_id");
    if (!bookingData) {
      return res.status(200).json({ success: false, message: "Booking not found" });
    }
    console.log("Booking Data", bookingData)
    const dealer = await Dealer.findById(bookingData.dealer_id);
    if (!dealer || !dealer.phone) {
      return res.status(200).json({ success: false, message: "Dealer phone number not found" });
    }
    console.log("Booking Data", bookingData)

    const phoneNumber = dealer.phone;

    // OTP Generate karna
    const otp = Math.floor(100000 + Math.random() * 900000);

    // OTP ko database me save karna
    bookingData.otp = 9999;
    await bookingData.save();

    // Twilio ya SMS API se OTP bhejna
    // const otpResponse = await sendotp(phoneNumber);

    res.status(200).json({ success: true, message: "OTP sent successfully to dealer" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const normalize10 = (p) => String(p).replace(/\D/g, "").slice(-10);
const with91 = (ten) => `91${ten}`;

const sendOtpToMobile = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(200).json({ success: false, message: "Booking ID is required" });
    }

    // 1) Fetch booking + user
    const bookingData = await booking
      .findById(bookingId)
      .populate("user_id", "phone first_name last_name");

    if (!bookingData) {
      return res.status(200).json({ success: false, message: "Booking not found" });
    }
    if (!bookingData.user_id || !bookingData.user_id.phone) {
      return res.status(200).json({ success: false, message: "User phone number not found" });
    }

    const rawPhone = bookingData.user_id.phone;
    const ten = normalize10(rawPhone);
    const e164 = with91(ten);

    // 2) Find the same customer by any stored representation (Number/String, 10/12 digits)
    const customer =
      await customers.findOne({ phone: { $in: [Number(ten), ten, Number(e164), e164] } }) ||
      await customers.findById(bookingData.user_id._id); // fallback by id, just in case

    if (!customer) {
      return res.status(200).json({ success: false, message: "User not found for this booking" });
    }

    // 3) Generate & save OTP on customer
    const otp = 1234; // static for now (testing)
    customer.otp = otp;
    // Optional expiry support if you add it to schema:
    // customer.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await customer.save();

    // 4) Send SMS (plug your provider here)
    // await sendSms(`+${e164}`, `Your OTP is ${otp}`);

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${e164}`,
      phone: Number(ten),
      otp // ⚠️ return only in dev/testing
    });
  } catch (error) {
    console.error("sendOtpToMobile error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const verifyOtpForMobile = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(200).json({ success: false, message: "Phone and OTP are required" });
    }

    const ten = normalize10(phone);
    const e164 = with91(ten);

    // Flexible lookup to match existing stored shapes
    const customer = await customers.findOne({
      phone: { $in: [Number(ten), ten, Number(e164), e164] }
    });

    if (!customer) {
      return res.status(200).json({ success: false, message: "User not found" });
    }

    // Optional expiry check
    // if (customer.otpExpiry && customer.otpExpiry < new Date()) {
    //   return res.status(200).json({ success: false, message: "OTP expired" });
    // }

    if (Number(otp) !== Number(customer.otp)) {
      return res.status(200).json({ success: false, message: "Invalid OTP" });
    }

    customer.otp = null; // clear after success
    await customer.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data: { customerId: customer._id }
    });
  } catch (err) {
    console.error("verifyOtpForMobile error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// const verifyBookingOTP = async (req, res) => {
//   try {
//     const { bookingId, otp } = req.body;

//     if (!bookingId || !otp) {
//       return res
//         .status(200)
//         .json({ success: false, message: "Booking ID and OTP are required" });
//     }

//     const bookingData = await booking.findById(bookingId).populate("dealer_id");
//     if (!bookingData) {
//       return res.status(200).json({ success: false, message: "Booking not found" });
//     }

//     const incomingOtp = String(otp).trim();

//     const storedOtp = bookingData.otp == null ? null : String(bookingData.otp);

//     const isValid =
//       incomingOtp === "9999" || (storedOtp && incomingOtp === storedOtp);

//     if (!isValid) {
//       return res.status(200).json({ success: false, message: "Invalid OTP" });
//     }

//     bookingData.otp = null;
//     bookingData.pickupStatus = "pickedup";
//     bookingData.pickupDate = new Date();
//     await bookingData.save();

//     return res
//       .status(200)
//       .json({ success: true, message: "OTP verified successfully by dealer" });
//   } catch (error) {
//     console.error(error);
//     return res
//       .status(500)
//       .json({ success: false, message: "Internal Server Error" });
//   }
// };

// POST /api/bookings/verify-otp

// const verifyBookingOTP = async (req, res) => {
//   try {
//     const { bookingId, otp, stage } = req.body;

//     if (!bookingId || !otp) {
//       return res.status(400).json({ success: false, message: "bookingId and otp are required" });
//     }

//     // optional: enforce 4-digit numeric
//     const incoming = String(otp).trim();
//     if (!/^\d{4}$/.test(incoming) && incoming !== "9999") {
//       return res.status(400).json({ success: false, message: "OTP must be 4 digits" });
//     }

//     const b = await booking.findById(bookingId);
//     if (!b) return res.status(404).json({ success: false, message: "Booking not found" });

//     // Decide which stage to verify
//     let targetStage = stage;
//     if (!targetStage) {
//       // Auto-detect if not provided:
//       if (b.pickupOtp != null) targetStage = "pickup";
//       else if (b.deliveryOtp != null) targetStage = "delivery";
//       else {
//         return res.status(200).json({ success: true, message: "Nothing to verify (both OTPs already verified)" });
//       }
//     }

//     if (!["pickup", "delivery"].includes(targetStage)) {
//       return res.status(400).json({ success: false, message: "stage must be 'pickup' or 'delivery'" });
//     }

//     // Prepare stored code and idempotency checks
//     const stored =
//       targetStage === "pickup"
//         ? (b.pickupOtp == null ? null : String(b.pickupOtp))
//         : (b.deliveryOtp == null ? null : String(b.deliveryOtp));

//     if (targetStage === "pickup" && b.pickupOtp == null) {
//       return res.status(200).json({ success: true, message: "Pickup already verified" });
//     }
//     if (targetStage === "delivery" && b.deliveryOtp == null) {
//       return res.status(200).json({ success: true, message: "Delivery already verified" });
//     }

//     // Validate (keep your override "9999" if you like)
//     const isValid = incoming === "9999" || (stored && incoming === stored);
//     if (!isValid) {
//       return res.status(200).json({ success: false, message: `Invalid ${targetStage} OTP` });
//     }

//     // Apply updates
//     if (targetStage === "pickup") {
//       b.pickupOtp = null;                       // clear after success
//       b.pickupStatus = "pickedup";
//       b.pickupDate = new Date();
//       if (b.status === "pending") b.status = "confirmed";
//       // optional if you add these fields:
//       // b.pickupVerifiedAt = new Date();
//     } else {
//       b.deliveryOtp = null;                     // clear after success
//       b.status = "completed";
//       b.serviceDate = b.serviceDate || new Date();
//       // b.deliveryVerifiedAt = new Date();
//     }

//     await b.save();

//     return res.status(200).json({
//       success: true,
//       message: `${targetStage[0].toUpperCase()}${targetStage.slice(1)} OTP verified`,
//     });
//   } catch (error) {
//     console.error("verifyBookingOTP error:", error);
//     return res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// };

const verifyBookingOTP = async (req, res) => {
  try {
    const { bookingId, otp, stage } = req.body;

    // require all 3 to avoid ambiguity
    if (!bookingId || !otp || !stage) {
      return res.status(400).json({
        success: false,
        message: "bookingId, otp and stage ('pickup'|'delivery') are required"
      });
    }

    const incoming = String(otp).trim();
    if (!/^\d{4}$/.test(incoming)) {
      return res.status(400).json({ success: false, message: "OTP must be exactly 4 digits" });
    }

    if (!["pickup", "delivery"].includes(stage)) {
      return res.status(400).json({ success: false, message: "stage must be 'pickup' or 'delivery'" });
    }

    // fetch booking
    const b = await booking.findById(bookingId);
    if (!b) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // pick stored otp explicitly for the requested stage
    const storedOtpRaw = stage === "pickup" ? b.pickupOtp : b.deliveryOtp;

    // if otp already cleared -> cannot verify again
    if (storedOtpRaw == null) {
      return res.status(409).json({
        success: false,
        message: `${stage[0].toUpperCase() + stage.slice(1)} OTP not present or already verified`
      });
    }

    const storedOtp = String(storedOtpRaw).trim();

    // Strict equality only — no overrides, no fallback
    if (incoming !== storedOtp) {
      // optional: you can increment a failedAttempts counter here if you extend schema
      return res.status(401).json({ success: false, message: `Invalid ${stage} OTP` });
    }

    // If we reached here, OTP is valid — apply updates
    if (stage === "pickup") {
      b.pickupOtp = null;
      b.pickupStatus = "pickedup";
      b.pickupDate = new Date();
      if (b.status === "pending") b.status = "confirmed";
    } else {
      b.deliveryOtp = null;
      b.status = "completed";
      b.serviceDate = b.serviceDate || new Date();
    }

    await b.save();

    return res.status(200).json({
      success: true,
      message: `${stage[0].toUpperCase() + stage.slice(1)} OTP verified`
    });
  } catch (error) {
    console.error("verifyBookingOTP error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const updatePickupStatus = async (req, res) => {
  try {
    const { bookingId, status } = req.body;

    // Validate Input
    if (!bookingId || !status) {
      return res.status(200).json({ success: false, message: "Booking ID and Status are required" });
    }

    // Valid Status Values
    const validStatuses = ["arriving", "arrived"];
    if (!validStatuses.includes(status)) {
      return res.status(200).json({ success: false, message: "Invalid status value" });
    }

    // Fetch Booking
    const bookingData = await booking.findById(bookingId);
    if (!bookingData) {
      return res.status(200).json({ success: false, message: "Booking not found" });
    }

    // Update Pickup Status
    bookingData.pickupStatus = status;
    await bookingData.save();

    res.status(200).json({ success: true, message: "Pickup status updated successfully", data: bookingData });
  } catch (error) {
    console.error("Error updating pickup status:", error);
    res.status(500).json({ success: false, message: error });
  }
};

async function addNoteToBooking(req, res) {
  try {
    const { bookingId, note } = req.body;

    if (!bookingId || !note) {
      return res.status(400).json({ success: false, message: "Booking ID and note are required" });
    }

    const updatedBooking = await booking.findByIdAndUpdate(
      bookingId,
      { $push: { additionalNotes: note } },
      { new: true }
    );

    if (!updatedBooking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    res.status(200).json({ success: true, message: "Note added successfully", data: updatedBooking.additionalNotes });
  } catch (error) {
    console.error("Add Note Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

async function getNotesFromBooking(req, res) {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID is required" });
    }

    const bookingData = await booking.findById(bookingId, "additionalNotes");

    if (!bookingData) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    res.status(200).json({ success: true, data: bookingData.additionalNotes });
  } catch (error) {
    console.error("Get Notes Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

async function updateNoteInBooking(req, res) {
  try {
    const { bookingId, noteIndex, newNote } = req.body;

    if (!bookingId || noteIndex === undefined || !newNote) {
      return res.status(400).json({ success: false, message: "Booking ID, note index, and new note are required" });
    }

    const updatedBooking = await booking.findById(bookingId);

    if (!updatedBooking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (noteIndex < 0 || noteIndex >= updatedBooking.additionalNotes.length) {
      return res.status(400).json({ success: false, message: "Invalid note index" });
    }

    updatedBooking.additionalNotes[noteIndex] = newNote;
    await updatedBooking.save();

    res.status(200).json({ success: true, message: "Note updated successfully", data: updatedBooking.additionalNotes });
  } catch (error) {
    console.error("Update Note Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// async function deleteNoteFromBooking(req, res) {
//   try {
//     const { bookingId, noteIndex } = req.body;

//     if (!bookingId || noteIndex === undefined) {
//       return res.status(400).json({ success: false, message: "Booking ID and note index are required" });
//     }

//     const updatedBooking = await booking.findById(bookingId);

//     if (!updatedBooking) {
//       return res.status(404).json({ success: false, message: "Booking not found" });
//     }

//     if (noteIndex < 0 || noteIndex >= updatedBooking.additionalNotes.length) {
//       return res.status(400).json({ success: false, message: "Invalid note index" });
//     }

//     updatedBooking.additionalNotes.splice(noteIndex, 1);
//     await updatedBooking.save();

//     res.status(200).json({ success: true, message: "Note deleted successfully", data: updatedBooking.additionalNotes });
//   } catch (error) {
//     console.error("Delete Note Error:", error);
//     res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// }

// By Prashant 

// Drop-in replacement: same signature, no schema changes required.
async function deleteNoteFromBooking(req, res) {
  try {
    const { bookingId, noteIndex } = req.body;
    console.log("Body", req.body)
    // Basic presence check
    if (!bookingId || noteIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and note index are required",
      });
    }

    // Coerce to integer and validate
    const idx = Number(noteIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({
        success: false,
        message: "noteIndex must be a non-negative integer",
      });
    }

    // Cheap fetch to verify existence and bounds
    const doc = await booking.findById(bookingId).select("additionalNotes");
    if (!doc) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (!Array.isArray(doc.additionalNotes) || idx >= doc.additionalNotes.length) {
      return res.status(400).json({ success: false, message: "Invalid note index" });
    }

    // 1) Unset the element at the index (atomic)
    const unsetPath = `additionalNotes.${idx}`;
    await booking.updateOne(
      { _id: bookingId },
      { $unset: { [unsetPath]: 1 } }
    );

    // 2) Remove the created null hole
    const updated = await booking.findByIdAndUpdate(
      bookingId,
      { $pull: { additionalNotes: null } },
      { new: true, select: "additionalNotes" }
    );

    return res.status(200).json({
      success: true,
      message: "Note deleted successfully",
      data: updated?.additionalNotes ?? [],
    });
  } catch (error) {
    console.error("Delete Note Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

async function getallbookings(req, res) {
  try {
    // Directly fetch bookings without auth
    const bookingresponce = await booking
      .find(req.query)
      .populate({
        path: "services",
        model: "AdminService"
      })
      .populate("dealer_id") // Fetch dealer details
      .populate("pickupAndDropId") // Fetch pickup & drop details
      .populate("user_id") // Fetch user details
      .sort({ "_id": -1 });

    if (bookingresponce.length > 0) {
      return res.status(200).json({
        status: 200,
        message: "Successfully retrieved bookings",
        data: bookingresponce,
        image_base_url: process.env.BASE_URL,
      });
    } else {
      return res.status(200).json({
        status: 200,
        message: "No bookings found",
        data: [],
      });
    }
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
    });
  }
}

module.exports = {
  addbooking,
  getallbookings,
  getbooking,
  deletebooking,
  getuserbookings,
  updateBookings,
  createBooking,
  getBookingDetails,
  updateBooking,
  updateBookingStatus,
  sendBookingOTP,
  verifyBookingOTP,
  updatePickupStatus,
  addNoteToBooking,
  getNotesFromBooking,
  updateNoteInBooking,
  deleteNoteFromBooking,
  sendOtpToMobile,
  verifyOtpForMobile
}
