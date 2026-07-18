const mongoose = require('mongoose');
const booking = require("../models/Booking");
const additionaloptions = require("../models/additionalOptionsModel");
const AdditionalService = require("../models/additionalServiceSchema");
const service = require("../models/service_model");
const bike = require("../models/bikeModel");
const Tracking = require("../models/Tracking");
const jwt_decode = require("jwt-decode");
const { isEmpty } = require("../helper/validation");
const customers = require("../models/customer_model");
const Role = require('../models/Roles_modal')
const Admin = require('../models/admin_model')
const { Notification, sendBookingNotification } = require("../helper/pushNotification");
const { handleBookingCompletion } = require("../controller/reward")
const { generateBill } = require("../controller/payment")
const { settleBookingWallet } = require("../helper/walletSettlement")
const UserBike = require("../models/userBikeModel");
const AdminService = require("../models/adminService");
const Customer = require("../models/customer_model");
const Vendor = require("../models/dealerModel");

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
    if (!customer) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const missingProfileFields = getMissingProfileFields(customer);
    if (missingProfileFields.length > 0) {
      return res.status(400).json({
        success: false,
        errorCode: "PROFILE_INCOMPLETE",
        message: "Please complete your profile before booking a service.",
        missingFields: missingProfileFields,
      });
    }

    // Log the incoming request body
    console.log("=== CREATE BOOKING REQUEST ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("User ID:", user_id);
    console.log("Services array:", req.body.services);
    console.log("Additional services:", req.body.additionalServices);
    console.log("Estimated cost:", req.body.estimated_cost);
    console.log("================================");

    // let services = await service.findById(req.params.id)
    // let services = await service.findById(req.params.id)
    const servicelist = req.body.services || req.body.Servicelist;
    const dealerIdToCheck = servicelist[0]?.dealerId;


    if (!servicelist.every(service => service.dealerId === dealerIdToCheck)) {
      return res.status(400).json({ message: 'All dealerId should be from the same dealer.' });
    }

    // Fetch service details to calculate pricing
    let totalServicePrice = 0;
    let serviceDetails = [];
    
    if (servicelist && servicelist.length > 0) {
      try {
        // Fetch all services to get their pricing
        const AdminService = require("../models/adminService");
        const fetchedServices = await AdminService.find({ _id: { $in: servicelist } }).lean();
        
        console.log("Fetched services:", fetchedServices);
        
        totalServicePrice = fetchedServices.reduce((sum, svc) => {
          console.log(`Service ${svc._id}: price = ${svc.price}`);
          return sum + (svc.price || 0);
        }, 0);
        
        serviceDetails = fetchedServices;
        console.log("Total service price calculated:", totalServicePrice);
      } catch (err) {
        console.log("Error fetching service details:", err.message);
      }
    }

    // Use calculated price or fallback to estimated_cost
    const finalTotalBill = totalServicePrice > 0 ? totalServicePrice : (req.body.estimated_cost || 0);
    console.log("Final total bill:", finalTotalBill);


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

    const dealers = await Vendor.find({ id: req.params.id }).exec();

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
                services: servicelist,
                bullet_points: bullet_points,
                additonal_options: additonal_options,
                model: bikes.model,
                brand: bikes.name,
                bike_charge: bikes.extra_charges,
                area: area.toLowerCase(),
                city: city.toLowerCase(),
                address: address,
                description: description,
                totalBill: finalTotalBill,
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
          services: servicelist,
          bullet_points: bullet_points,
          additonal_options: additonal_options,
          model: bikes.model,
          brand: bikes.name,
          bike_charge: bikes.extra_charges,
          area: area.toLowerCase(),
          city: city.toLowerCase(),
          address: address,
          description: description,
          totalBill: finalTotalBill,
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
        services: servicelist,
        bullet_points: bullet_points,
        //additonal_options:additonal_options,
        model: bikes.model,
        brand: bikes.name,
        bike_charge: bikes.extra_charges,
        area: area.toLowerCase(),
        city: city.toLowerCase(),
        address: address,
        description: description,
        totalBill: finalTotalBill,
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
        model: "AdminService",
        populate: {
          path: "base_service_id",
          model: "BaseService",
          select: "name description image",
        },
      })
        .populate({
          path: "additionalServices",
          populate: { path: "base_additional_service_id", select: "name" },
        })
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

    // Fetch bill information for each booking (optional - for additional details)
    try {
      const Bill = require("../models/billSchema");
      const bookingIds = userBookings.map(b => b._id);
      const bills = await Bill.find({ booking_id: { $in: bookingIds } }).lean();
      
      // Create a map of booking_id -> bill for quick lookup
      const billMap = {};
      bills.forEach(bill => {
        billMap[bill.booking_id.toString()] = bill;
      });

      // Add pricing information to each booking
      // Priority: Bill data > Booking totalBill > 0
      const enrichedBookings = userBookings.map(b => {
        const bill = billMap[b._id.toString()];
        
        // Use bill data if available, otherwise use booking's totalBill
        const grandTotal = bill?.total_amount || b.totalBill || 0;
        const subtotal = bill?.subtotal || b.totalBill || 0;
        
        console.log(`=== Booking ${b.bookingId} ===`);
        console.log("Booking object keys:", Object.keys(b));
        console.log("totalBill:", b.totalBill);
        console.log("pickupCharges:", b.pickupCharges);
        console.log("services count:", b.services?.length);
        console.log("userBike_id:", b.userBike_id);
        console.log("Bill found:", !!bill);
        if (bill) {
          console.log("Bill total_amount:", bill.total_amount);
          console.log("Bill subtotal:", bill.subtotal);
        }
        console.log("Final grandTotal:", grandTotal);
        console.log("---");
        
        return {
          ...b,
          subtotal: subtotal,
          tax_amount: bill?.tax_amount || 0,
          grandTotal: grandTotal,
          pickupCharges: b.pickupCharges || 0,
        };
      });

      return res.status(200).json({
        status: 200,
        success: true,
        data: enrichedBookings,
        meta: { total, page, limit, pages: Math.ceil(total / limit) }
      });
    } catch (billError) {
      console.log("Error fetching bills, using booking totalBill instead:", billError.message);
      
      // Fallback: Use booking's totalBill if bill fetch fails
      const enrichedBookings = userBookings.map(b => ({
        ...b,
        subtotal: b.totalBill || 0,
        tax_amount: 0,
        grandTotal: b.totalBill || 0,
        pickupCharges: b.pickupCharges || 0,
      }));

      return res.status(200).json({
        status: 200,
        success: true,
        data: enrichedBookings,
        meta: { total, page, limit, pages: Math.ceil(total / limit) }
      });
    }

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

    let dealers = await Vendor.findOne({ _id: dealer_id }); // changes

    if (!dealers) {
      res.status(201).json({ status: 201, error: "No Dealer Found" });
      return;
    }

    // Block booking acceptance if dealer has exceeded credit limit
    if (status === "confirmed") {
      const BOOKING_CREDIT_LIMIT = -500;
      if (parseFloat(dealers.wallet) < BOOKING_CREDIT_LIMIT) {
        return res.status(200).json({
          status: 200,
          message: "Booking cannot be accepted. Please clear your outstanding dues to continue accepting bookings."
        });
      }
    }

    const datas =
    {
      status: status,
      dealer_name: dealers.shopName,
      dealr_id: dealers.id,
      dealer_id: dealer_id,
      dealer_address: dealers.fullAddress,
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

// Mandatory profile fields required before a booking can be created.
function getMissingProfileFields(user) {
  const missing = [];
  if (!user.first_name || isEmpty(user.first_name)) missing.push("full name");
  if (!user.phone || isEmpty(String(user.phone))) missing.push("mobile number");
  return missing;
}

async function createBooking(req, res) {
  try {
    console.log('Booking Started');

    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const data = jwt_decode(req.headers.token);
    const user_id = data.user_id;

    // ── 2. Entry logging ─────────────────────────────────────────────────────
    console.log('[createBooking] REQUEST BODY:', JSON.stringify(req.body, null, 2));
    console.log('[createBooking] Authenticated user_id:', user_id);

    // ── 2b. Profile completeness check ───────────────────────────────────────
    const bookingUser = await customers.findById(user_id).select("first_name phone");
    if (!bookingUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const missingProfileFields = getMissingProfileFields(bookingUser);
    if (missingProfileFields.length > 0) {
      console.log('[createBooking] Blocked — incomplete profile, missing:', missingProfileFields);
      return res.status(400).json({
        success: false,
        errorCode: "PROFILE_INCOMPLETE",
        message: "Please complete your profile before booking a service.",
        missingFields: missingProfileFields,
      });
    }

    const { dealer_id, services, pickupAndDropId, userBike_id, pickupDate, scheduleDate, timeSlot, pickupAddress } = req.body;

    // ── 3. Field-level validation logging ────────────────────────────────────
    console.log('[createBooking] Field check — dealer_id:', dealer_id, '| valid ObjectId:', mongoose.Types.ObjectId.isValid(dealer_id));
    console.log('[createBooking] Field check — services:', services, '| isArray:', Array.isArray(services), '| length:', Array.isArray(services) ? services.length : 'N/A');
    console.log('[createBooking] Field check — userBike_id:', userBike_id, '| valid ObjectId:', mongoose.Types.ObjectId.isValid(userBike_id));
    console.log('[createBooking] Field check — pickupAndDropId:', pickupAndDropId, '| type:', typeof pickupAndDropId);
    console.log('[createBooking] Field check — pickupDate:', pickupDate, '| parsed Date:', pickupDate ? new Date(pickupDate) : null);

    if (!dealer_id || !services || services.length === 0) {
      return res.status(400).json({ success: false, message: "Dealer and at least one service are required" });
    }
    if (!userBike_id) {
      return res.status(400).json({ success: false, message: "User bike is required" });
    }

    // Calculate initial bill based on services and bike CC
    let totalBill = 0;
    // User App sends BaseService IDs; resolve to AdminService IDs for correct pricing and refs
    let resolvedServiceIds = services;
    try {
      const bikeData = await UserBike.findById(userBike_id);
      console.log("=== Calculating totalBill ===");
      console.log("Bike found:", !!bikeData);
      if (bikeData) {
        console.log("Bike CC:", bikeData.bike_cc);
        const bikeCC = parseInt(bikeData.bike_cc || 0);

        // Primary: incoming IDs are BaseService IDs — find AdminService for this dealer
        let serviceDocs = await AdminService.find({
          base_service_id: { $in: services },
          dealer_id: dealer_id,
          isActive: true,
        });
        console.log("Services found via base_service_id:", serviceDocs.length);

        // Fallback: IDs may already be AdminService IDs (e.g. other clients)
        if (serviceDocs.length === 0) {
          serviceDocs = await AdminService.find({ _id: { $in: services } });
          console.log("Services found via direct _id:", serviceDocs.length);
        }

        if (serviceDocs.length > 0) {
          resolvedServiceIds = serviceDocs.map(s => s._id);
        }

        serviceDocs.forEach((svc, idx) => {
          console.log(`Service ${idx}:`, {
            base_service_id: svc.base_service_id,
            bikesCount: svc.bikes?.length || 0,
            bikes: svc.bikes?.map(b => ({ cc: b.cc, price: b.price }))
          });

          const matchingBike = svc.bikes?.find(b => b.cc === bikeCC);
          console.log(`Matching bike for CC ${bikeCC}:`, matchingBike);

          if (matchingBike) {
            totalBill += matchingBike.price;
            console.log(`Added ${matchingBike.price} to totalBill. New total: ${totalBill}`);
          }
        });
      }
      console.log("Final totalBill:", totalBill);
      console.log("---");
    } catch (priceError) {
      console.error("Error calculating initial bill:", priceError);
      // Fallback to 0 if calculation fails
    }

    const pickupOtp = genOtp();
    const deliveryOtp = genOtp();

    // ── 4. Pre-save payload log ───────────────────────────────────────────────
    console.log('[createBooking] PRE-SAVE payload:', JSON.stringify({
      user_id,
      dealer_id,
      services: resolvedServiceIds,
      pickupAndDropId: pickupAndDropId || null,
      userBike_id,
      pickupDate: pickupDate || null,
      totalBill,
    }, null, 2));

    const newBooking = new booking({
      user_id,
      dealer_id,
      services: resolvedServiceIds,
      pickupAndDropId: pickupAndDropId || null,
      userBike_id,
      pickupDate: pickupDate || null,
      scheduleDate: scheduleDate || null,
      timeSlot: timeSlot || null,
      pickupAddress: pickupAddress || null,
      pickupOtp,
      deliveryOtp,
      totalBill,
      status: "pending",
      dealerResponseStatus: "awaiting",
      timerExpiresAt: new Date(Date.now() + 60 * 1000),
    });

    await newBooking.save();

    console.log('[BOOKING-CREATED] Save successful');
    console.log(`[BOOKING-CREATED] _id: ${newBooking._id} | bookingId: ${newBooking.bookingId}`);
    console.log(`[BOOKING-CREATED] status: ${newBooking.status} | payment_method: ${newBooking.payment_method} (null = payment not yet selected — correct)`);
    console.log(`[BOOKING-CREATED] Booking created with timer: ${newBooking._id}`);

    // ── Notify dealer: socket + FCM ──────────────────────────────────────────
    try {
      const dealer = await Vendor.findById(dealer_id).select("device_token").lean();

      // Socket: push booking:new to dealer's personal room
      const io = req.app.get("io");
      if (io) {
        io.to(`dealer:${dealer_id}`).emit("booking:new", {
          bookingId: newBooking._id,
          timerExpiresAt: newBooking.timerExpiresAt,
        });
      }

      // FCM: push notification to dealer app
      if (dealer?.device_token) {
        sendBookingNotification({
          token: dealer.device_token,
          title: "New Booking Request",
          body: "You have received a new booking request.",
          data: { type: "new_booking", bookingId: newBooking._id.toString() },
          receiverId: dealer_id,
          receiverType: "dealer",
          bookingId: newBooking._id,
        });
      }
    } catch (notifyErr) {
      console.error("[BOOKING-CREATED] Dealer notification error:", notifyErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: newBooking,
      pickupOtp,
      deliveryOtp,
      timerExpiresAt: newBooking.timerExpiresAt,
      dealerResponseStatus: newBooking.dealerResponseStatus,
    });
  } catch (error) {
    console.error('[createBooking] FATAL ERROR — name:', error.name);
    console.error('[createBooking] FATAL ERROR — message:', error.message);
    console.error('[createBooking] STACK:', error.stack);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error',
      errorType: error.name,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    });
  }
}

async function getBookingDetails(req, res) {
  try {
    let bookingId = req.params.id;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID is required" });
    }

    console.log("=== getBookingDetails ===");
    console.log("Booking ID received:", bookingId);
    console.log("Is valid ObjectId:", mongoose.Types.ObjectId.isValid(bookingId));

    // Try to find the booking
    const bookingData = await booking.findById(bookingId)
      .populate("user_id")
      .populate("dealer_id")
      .populate({
        path: "services",
        model: "AdminService",
        populate: {
          path: "base_service_id",
          model: "BaseService",
          select: "name description image",
        },
      })
      .populate({
        path: "additionalServices",
        populate: { path: "base_additional_service_id", select: "name" },
      })
      .populate("pickupAndDropId")
      .populate("userBike_id");

    console.log("Booking found:", !!bookingData);

    if (!bookingData) {
      console.log("Booking not found for ID:", bookingId);
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    console.log("Booking status:", bookingData.status);
    console.log("Booking ID (custom):", bookingData.bookingId);
    console.log("Booking totalBill:", bookingData.totalBill);

    // Fetch bill information if it exists (optional - for additional details)
    let billData = null;
    try {
      const Bill = require("../models/billSchema");
      billData = await Bill.findOne({ booking_id: bookingId });
      console.log("Bill found:", !!billData);
      if (billData) {
        console.log("Bill total_amount:", billData.total_amount);
      }
    } catch (err) {
      console.log("Error fetching bill:", err.message);
    }

    // Use bill data if available, otherwise use booking's totalBill
    const grandTotal = billData?.total_amount || bookingData.totalBill || 0;
    const subtotal = billData?.subtotal || bookingData.totalBill || 0;

    const result = {
      ...bookingData.toObject(),
      subtotal: subtotal,
      tax_amount: billData?.tax_amount || 0,
      grandTotal: grandTotal,
      pickupCharges: bookingData.pickupCharges || 0,
    };

    console.log("Returning booking details with grandTotal:", grandTotal);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error in getBookingDetails:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error", 
      error: error.message 
    });
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

    // Recalculate totalBill using per-CC pricing from main + additional services
    try {
      const bikeData = await UserBike.findById(existingBooking.userBike_id).select("bike_cc");
      const bikeCC = parseInt(bikeData?.bike_cc || 0);
      const resolvePrice = (doc) => {
        const match = doc.bikes?.find(b => b.cc === bikeCC);
        return match ? match.price : 0;
      };
      const [mainDocs, addlDocs] = await Promise.all([
        AdminService.find({ _id: { $in: existingBooking.services } }).select("bikes"),
        AdditionalService.find({ _id: { $in: existingBooking.additionalServices } }).select("bikes"),
      ]);
      let recalcTotal = 0;
      mainDocs.forEach(d => { recalcTotal += resolvePrice(d); });
      addlDocs.forEach(d => { recalcTotal += resolvePrice(d); });
      existingBooking.totalBill = recalcTotal;
    } catch (calcErr) {
      console.error("[updateBooking] totalBill recalculation failed:", calcErr.message);
    }

    await existingBooking.save();

    // ✅ Populate the correct path for an ObjectId[] ref
    await existingBooking.populate({
      path: "additionalServices",
      select: "_id id name image description bikes",
      populate: { path: "base_additional_service_id", select: "name" }
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

    // ── Expiry window guard (confirmed / rejected only) ──────────────────────
    // Transitions like completed / cash received happen after the booking is
    // already confirmed, so timerExpiresAt being in the past is expected there.
    // Only dealer accept / reject responses must be within the 60-second window.
    if (status === "confirmed" || status === "rejected") {
      if (
        existingBooking.status === "expired" ||
        existingBooking.dealerResponseStatus === "expired" ||
        (existingBooking.timerExpiresAt && existingBooking.timerExpiresAt < new Date())
      ) {
        console.log(`[BOOKING-EXPIRED-BLOCKED] Dealer blocked from "${status}" on expired booking: ${bookingId}`);
        return res.status(400).json({
          success: false,
          message: "Booking response window has expired. The user will be notified to choose another dealer."
        });
      }
    }

    // Block booking acceptance if dealer has exceeded credit limit
    if (status === "confirmed") {
      const BOOKING_CREDIT_LIMIT = -500;
      const dealerForCheck = await Vendor.findById(existingBooking.dealer_id).select("wallet").lean();
      const dealerWallet = parseFloat(dealerForCheck?.wallet) || 0;
      if (dealerWallet < BOOKING_CREDIT_LIMIT) {
        return res.status(200).json({
          success: false,
          message: "Booking cannot be accepted. Please clear your outstanding dues to continue accepting bookings."
        });
      }
    }

    // ── Update status ─────────────────────────────────────────────────────────
    if (status === "confirmed" || status === "rejected") {
      // Atomic write: only succeeds if the booking is still pending+awaiting
      // within the timer window. If the expiry job fired between our read above
      // and this update, findOneAndUpdate returns null and we block the response.
      const atomicResult = await booking.findOneAndUpdate(
        {
          _id: existingBooking._id,
          status: "pending",
          dealerResponseStatus: "awaiting",
          timerExpiresAt: { $gt: new Date() },
        },
        {
          $set: {
            status: status,
            dealerResponseStatus: status === "confirmed" ? "accepted" : "rejected",
          },
        },
        { new: true }
      );

      if (!atomicResult) {
        // Expiry job won the race between our read and this write
        console.log(`[BOOKING-EXPIRED-BLOCKED] Race condition caught — booking already expired: ${bookingId}`);
        return res.status(400).json({
          success: false,
          message: "Booking response window has expired. The user will be notified to choose another dealer."
        });
      }

      existingBooking = atomicResult;

      if (status === "confirmed") {
        console.log(`[BOOKING-ACCEPTED] Dealer accepted booking: ${bookingId}`);
      } else {
        console.log(`[BOOKING-REJECTED] Dealer rejected booking: ${bookingId}`);
      }

      // Notify user via socket
      const io = req.app.get("io");
      if (io) {
        const eventName = status === "confirmed" ? "booking:confirmed" : "booking:rejected";
        io.to(`booking:${bookingId}`).emit(eventName, {
          bookingId,
          dealerResponseStatus: existingBooking.dealerResponseStatus,
        });
      }

      // FCM: push notification to user on accept / reject
      try {
        const userForNotif = await Customer.findById(existingBooking.user_id)
          .select("device_token ftoken")
          .lean();
        const userToken = userForNotif?.device_token || userForNotif?.ftoken;
        if (userToken) {
          await sendBookingNotification({
            token: userToken,
            title: status === "confirmed" ? "Booking Accepted" : "Booking Rejected",
            body: status === "confirmed"
              ? "Your booking has been accepted by the dealer."
              : "The dealer rejected your booking request.",
            data: {
              type: status === "confirmed" ? "booking_accepted" : "booking_rejected",
              bookingId: bookingId.toString(),
            },
            receiverId: existingBooking.user_id,
            receiverType: "user",
            bookingId: existingBooking._id,
          });
        }
      } catch (notifyErr) {
        console.error("[BOOKING-RESPONSE] User FCM notification error:", notifyErr.message);
      }
    } else {
      // All other transitions (completed, cash received, cancelled, etc.)
      existingBooking.status = status;

      if (status === "cash received") {
        existingBooking.billStatus = "paid";
      }

      await existingBooking.save();
    }

    // Handle completion logic if needed
    if (status === "completed") {
      await handleBookingCompletion(existingBooking);
    }

    // Generate invoice for cash payment if not already generated
    if (status === "cash received" && !existingBooking.billGenerated) {
      try {
        await generateBill({
          booking_id: existingBooking._id,
          payment_method: "CASH",
          transaction_id: null,
          _id: null
        });
      } catch (billError) {
        console.error("Bill generation failed for cash payment:", billError);
      }
    }

    // Automatic wallet settlement — debit commission owed to platform for cash booking
    if (status === "cash received") {
      try {
        const settlement = await settleBookingWallet(existingBooking._id, "CASH");
        if (settlement) {
          console.log(`✅ Cash commission settled: dealer debited ₹${settlement.txnAmount} (order ₹${settlement.orderAmount}, commission ${settlement.commissionRate}%)`);
        } else {
          console.log(`ℹ️ Wallet already settled for booking: ${existingBooking._id}`);
        }
      } catch (settlementErr) {
        console.error(`❌ Cash commission settlement failed for booking ${existingBooking._id}:`, settlementErr.message);
      }
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
    const dealer = await Vendor.findById(bookingData.dealer_id);
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

    if (stage === "delivery") {
      await handleBookingCompletion(b);
    }

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
        model: "AdminService",
        populate: {
          path: "base_service_id",
          model: "BaseService",
          select: "name description image",
        },
      })
      .populate("dealer_id") // Fetch dealer details
      .populate("pickupAndDropId") // Fetch pickup & drop details
      .populate("user_id") // Fetch user details
      .populate({
        path: "userBike_id", // Fetch bike details
        populate: {
          path: "variant_id",
          model: "BikeVariant",
          select: "variant_name engine_cc model_id",
          populate: {
            path: "model_id",
            model: "BikeModel",
            select: "model_name company_id",
            populate: {
              path: "company_id",
              model: "BikeCompany",
              select: "name",
            },
          },
        },
      })
      .sort({ "_id": -1 });

    if (bookingresponce.length > 0) {
      const data = bookingresponce.map((doc) => {
        const item = doc.toObject({ virtuals: true });
        const userBike = item.userBike_id;
        const variant = userBike?.variant_id;
        const model = variant?.model_id;
        const company = model?.company_id;

        // Resolve real catalog names via variant_id chain; userBike_id.name/model
        // may hold stale free-text (or, for older records, raw ObjectIds) so they
        // are not used when the catalog chain is available.
        item.bike = {
          company_name: company?.name ?? null,
          model_name: model?.model_name ?? null,
          variant_name: variant?.variant_name ?? null,
          engine_cc: variant?.engine_cc ?? null,
          plate_number: userBike?.plate_number ?? null,
        };

        return item;
      });

      return res.status(200).json({
        status: 200,
        message: "Successfully retrieved bookings",
        data,
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

// Cancel Booking - User can cancel pending bookings
async function cancelBooking(req, res) {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        status: 400,
        message: "Booking ID is required"
      });
    }

    // Find the booking
    const bookingData = await booking.findById(bookingId);
    if (!bookingData) {
      return res.status(404).json({
        status: 404,
        message: "Booking not found"
      });
    }

    // Check if booking is in pending status
    if (bookingData.status !== "pending") {
      return res.status(400).json({
        status: 400,
        message: `Cannot cancel booking with status: ${bookingData.status}. Only pending bookings can be cancelled.`
      });
    }

    // Update booking status to cancelled
    const updatedBooking = await booking.findByIdAndUpdate(
      bookingId,
      { $set: { status: "cancelled" } },
      { new: true }
    );

    // Update tracking status if exists
    await Tracking.updateOne(
      { booking_id: bookingId },
      { $set: { status: "cancelled" } }
    );

    // Send notification to user
    const user = await customers.findById(bookingData.created_by);
    if (user && (user.device_token || user.ftoken)) {
      Notification(
        user.device_token || user.ftoken,
        `Your booking for ${bookingData.brand} ${bookingData.model} has been cancelled successfully`,
        user.id
      );
    }

    return res.status(200).json({
      status: 200,
      message: "Booking cancelled successfully",
      data: updatedBooking
    });

  } catch (error) {
    console.error("Error cancelling booking:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message
    });
  }
}

async function getBookingTimerStatus(req, res) {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const bookingData = await booking
      .findById(bookingId)
      .select("_id bookingId status dealerResponseStatus timerExpiresAt")
      .lean();

    if (!bookingData) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const now = new Date();

    // secondsRemaining is 0 for any terminal dealer-response state
    const isTerminal =
      !bookingData.timerExpiresAt ||
      bookingData.status === "expired" ||
      bookingData.dealerResponseStatus === "accepted" ||
      bookingData.dealerResponseStatus === "rejected" ||
      bookingData.dealerResponseStatus === "expired";

    const secondsRemaining = isTerminal
      ? 0
      : Math.max(0, Math.floor((new Date(bookingData.timerExpiresAt) - now) / 1000));

    return res.status(200).json({
      success: true,
      bookingId: bookingData._id,
      status: bookingData.status,
      dealerResponseStatus: bookingData.dealerResponseStatus,
      timerExpiresAt: bookingData.timerExpiresAt,
      secondsRemaining,
    });
  } catch (error) {
    console.error("getBookingTimerStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE COMPLETE → PAYMENT → DELIVERY OTP FLOW
// ─────────────────────────────────────────────────────────────────────────────

// 1. Dealer marks service as complete
// POST /bookings/:bookingId/service-complete  { user_id }
const serviceComplete = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { user_id } = req.body;

    if (!bookingId || !user_id) {
      return res.status(400).json({
        success: false,
        message: "bookingId (param) and user_id (body) are required",
      });
    }

    const bookingDoc = await booking.findById(bookingId);
    if (!bookingDoc) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (bookingDoc.dealer_id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned dealer can mark service as complete",
      });
    }

    if (bookingDoc.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: `Cannot mark service complete. Current status: ${bookingDoc.status}. Expected: confirmed`,
      });
    }

    bookingDoc.status = "awaiting_payment";
    await bookingDoc.save();

    console.log(`[SERVICE-COMPLETE] Booking ${bookingId} → awaiting_payment`);

    // Push notification to user
    try {
      const user = await Customer.findById(bookingDoc.user_id)
        .select("device_token ftoken")
        .lean();
      const userToken = user?.device_token || user?.ftoken;
      if (userToken) {
        await sendBookingNotification({
          token: userToken,
          title: "Service Completed",
          body: "Your bike service has been completed. Please select a payment method.",
          data: { type: "service_completed", bookingId: bookingId.toString() },
          receiverId: bookingDoc.user_id,
          receiverType: "user",
          bookingId: bookingDoc._id,
        });
      }
    } catch (notifyErr) {
      console.error("[SERVICE-COMPLETE] FCM error:", notifyErr.message);
    }

    // Socket emit to user room
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${bookingDoc.user_id}`).emit("booking:service_complete", {
        bookingId,
        status: "awaiting_payment",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service marked complete. User notified to select payment method.",
      data: { bookingId, status: "awaiting_payment" },
    });
  } catch (error) {
    console.error("[SERVICE-COMPLETE] Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 2. Dealer selects ONLINE (QR) or CASH payment method on the customer's behalf
// POST /bookings/:bookingId/select-payment-method  { user_id, payment_method }
// NOTE: `user_id` here is the dealer's id (kept for backward compatibility with
// sibling endpoints in this flow, e.g. serviceComplete/confirmCashReceived, which
// already use `user_id` in the body to mean "the acting dealer").
const selectPaymentMethod = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { user_id, payment_method } = req.body;

    if (!bookingId || !user_id || !payment_method) {
      return res.status(400).json({
        success: false,
        message: "bookingId (param), user_id and payment_method are required",
      });
    }

    if (!["ONLINE", "CASH"].includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: "payment_method must be 'ONLINE' or 'CASH'",
      });
    }

    const bookingDoc = await booking.findById(bookingId);
    if (!bookingDoc) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Dealer-only guard — the user app must not initiate payment anymore
    if (bookingDoc.dealer_id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned dealer can select a payment method",
      });
    }

    // Status guard — the dealer may (re)select a payment method for as long as
    // the booking is still in the payment-collection stage. This allows e.g.
    // switching ONLINE → CASH after a QR was generated but never paid. Once
    // payment actually completes, the booking moves past both of these
    // statuses (see payment_status guard below and confirmCashReceived /
    // advanceBookingAfterOnlinePayment), so this list also implicitly blocks
    // changes after payment_success/ready_for_delivery/delivered/cancelled.
    const PAYMENT_METHOD_SELECTABLE_STATUSES = ["awaiting_payment", "payment_selected"];
    if (!PAYMENT_METHOD_SELECTABLE_STATUSES.includes(bookingDoc.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot select payment method. Current status: ${bookingDoc.status}. Expected one of: ${PAYMENT_METHOD_SELECTABLE_STATUSES.join(", ")}`,
      });
    }

    // Payment-completed guard — once payment has actually succeeded, the
    // method can never be changed, even if the status guard above were ever
    // loosened further.
    if (bookingDoc.payment_status === "completed") {
      return res.status(409).json({
        success: false,
        message: "Payment has already been completed. Payment method cannot be changed.",
      });
    }

    bookingDoc.payment_method = payment_method;
    bookingDoc.status = "payment_selected";
    await bookingDoc.save();

    console.log(`[SELECT-PAYMENT] Booking ${bookingId} → payment_selected (${payment_method})`);

    const io = req.app.get("io");

    // ── ONLINE (QR) PATH ───────────────────────────────────────────────────────
    // QR generation itself is handled by the existing Cashfree UPI-QR flow
    // (POST /cashfree/generate-qr), which already lands on the same
    // invoice + wallet-settlement + delivery-OTP outcome as confirmCashReceived
    // once payment succeeds. We only flip the booking into payment_selected
    // (done above) and point the dealer at that endpoint — no second/duplicate
    // Cashfree order integration here.
    if (payment_method === "ONLINE") {
      try {
        const dealer = await Vendor.findById(bookingDoc.dealer_id)
          .select("device_token ftoken")
          .lean();
        const dealerToken = dealer?.device_token || dealer?.ftoken;
        if (dealerToken) {
          await sendBookingNotification({
            token: dealerToken,
            title: "Generate Payment QR",
            body: "Online payment selected. Generate a QR for the customer to scan and pay.",
            data: {
              type: "online_payment_selected",
              bookingId: bookingId.toString(),
            },
            receiverId: bookingDoc.dealer_id,
            receiverType: "dealer",
            bookingId: bookingDoc._id,
          });
        }
      } catch (notifyErr) {
        console.error("[SELECT-PAYMENT] Dealer FCM error:", notifyErr.message);
      }

      if (io) {
        io.to(`dealer:${bookingDoc.dealer_id}`).emit("booking:online_payment_selected", {
          bookingId,
          status: "payment_selected",
          payment_method: "ONLINE",
        });
      }

      return res.status(200).json({
        success: true,
        payment_method: "ONLINE",
        message: "Online payment selected. Generate a QR via /cashfree/generate-qr to collect payment.",
        data: {
          bookingId,
          status: "payment_selected",
          amount: bookingDoc.totalBill,
          next_step: {
            method: "POST",
            path: "/bikedoctor/cashfree/generate-qr",
            body: { booking_id: bookingId, amount: bookingDoc.totalBill },
          },
        },
      });
    }

    // ── CASH PATH ──────────────────────────────────────────────────────────────
    try {
      const dealer = await Vendor.findById(bookingDoc.dealer_id)
        .select("device_token ftoken")
        .lean();
      const dealerToken = dealer?.device_token || dealer?.ftoken;
      if (dealerToken) {
        await sendBookingNotification({
          token: dealerToken,
          title: "Cash Payment Expected",
          body: "Customer will pay cash at pickup. Please confirm when cash is received.",
          data: {
            type: "cash_payment_selected",
            bookingId: bookingId.toString(),
          },
          receiverId: bookingDoc.dealer_id,
          receiverType: "dealer",
          bookingId: bookingDoc._id,
        });
      }
    } catch (notifyErr) {
      console.error("[SELECT-PAYMENT] Dealer FCM error:", notifyErr.message);
    }

    if (io) {
      io.to(`dealer:${bookingDoc.dealer_id}`).emit("booking:cash_payment_selected", {
        bookingId,
        status: "payment_selected",
        payment_method: "CASH",
      });
    }

    return res.status(200).json({
      success: true,
      payment_method: "CASH",
      message: "Cash payment selected. Dealer has been notified.",
      data: { bookingId, status: "payment_selected" },
    });
  } catch (error) {
    console.error("[SELECT-PAYMENT] Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 3. Dealer confirms cash received from customer
// POST /bookings/:bookingId/confirm-cash-received  { user_id }
const confirmCashReceived = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { user_id } = req.body;

    if (!bookingId || !user_id) {
      return res.status(400).json({
        success: false,
        message: "bookingId (param) and user_id (body) are required",
      });
    }

    const bookingDoc = await booking.findById(bookingId);
    if (!bookingDoc) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Dealer-only guard
    if (bookingDoc.dealer_id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned dealer can confirm cash receipt",
      });
    }

    // Payment method guard — select-payment-method is always the entry point,
    // so payment_method must already be "CASH" by the time this is called.
    if (bookingDoc.payment_method !== "CASH") {
      return res.status(400).json({
        success: false,
        message: `This endpoint is for CASH payments only. Current payment_method: ${bookingDoc.payment_method}`,
      });
    }

    // Status guard
    if (bookingDoc.status !== "payment_selected") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm cash. Current status: ${bookingDoc.status}. Expected: payment_selected`,
      });
    }

    const freshOtp = genOtp();

    bookingDoc.payment_status   = "completed";
    bookingDoc.payment_verified = true;
    bookingDoc.deliveryOtp      = freshOtp;
    bookingDoc.status           = "ready_for_delivery";
    bookingDoc.billStatus       = "paid";
    await bookingDoc.save();

    console.log(`[CASH-CONFIRM] Booking ${bookingId} → ready_for_delivery | OTP: ${freshOtp}`);

    // Bill generation — reuse existing generateBill
    try {
      await generateBill({
        booking_id: bookingDoc._id,
        payment_method: "CASH",
        transaction_id: null,
        _id: null,
      });
    } catch (billErr) {
      console.error("[CASH-CONFIRM] Bill generation failed:", billErr.message);
    }

    // Wallet settlement — reuse existing settleBookingWallet
    try {
      const settlement = await settleBookingWallet(bookingDoc._id, "CASH");
      if (settlement) {
        console.log(`[CASH-CONFIRM] Wallet settled: ₹${settlement.txnAmount} debited (commission ${settlement.commissionRate}%)`);
      } else {
        console.log(`[CASH-CONFIRM] Wallet already settled for booking: ${bookingId}`);
      }
    } catch (settlErr) {
      console.error("[CASH-CONFIRM] Wallet settlement failed:", settlErr.message);
    }

    // Push OTP to user — OTP is in data payload only, NOT in notification body
    try {
      const user = await Customer.findById(bookingDoc.user_id)
        .select("device_token ftoken")
        .lean();
      const userToken = user?.device_token || user?.ftoken;
      if (userToken) {
        await sendBookingNotification({
          token: userToken,
          title: "Cash Confirmed — Show OTP to Dealer",
          body: "Cash payment confirmed. Show the OTP to the dealer to collect your bike.",
          data: {
            type: "otp_ready",
            bookingId: bookingId.toString(),
            otp: String(freshOtp),
          },
          receiverId: bookingDoc.user_id,
          receiverType: "user",
          bookingId: bookingDoc._id,
        });
      }
    } catch (notifyErr) {
      console.error("[CASH-CONFIRM] User FCM error:", notifyErr.message);
    }

    // Socket emit to user room
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${bookingDoc.user_id}`).emit("booking:ready_for_delivery", {
        bookingId,
        status: "ready_for_delivery",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cash confirmed. Delivery OTP sent to customer.",
      data: { bookingId, status: "ready_for_delivery" },
    });
  } catch (error) {
    console.error("[CASH-CONFIRM] Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 4. Dealer verifies the handover OTP shown by the customer
// POST /bookings/verify-delivery-otp  { bookingId, otp, user_id }
const verifyDeliveryOtp = async (req, res) => {
  try {
    const { bookingId, otp, user_id } = req.body;

    if (!bookingId || !otp || !user_id) {
      return res.status(400).json({
        success: false,
        message: "bookingId, otp and user_id are required",
      });
    }

    const incoming = String(otp).trim();
    if (!/^\d{4}$/.test(incoming)) {
      return res.status(400).json({ success: false, message: "OTP must be exactly 4 digits" });
    }

    const bookingDoc = await booking.findById(bookingId);
    if (!bookingDoc) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Dealer-only guard
    if (bookingDoc.dealer_id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned dealer can verify the handover OTP",
      });
    }

    // Status guard
    if (bookingDoc.status !== "ready_for_delivery") {
      return res.status(400).json({
        success: false,
        message: `Cannot verify delivery OTP. Current status: ${bookingDoc.status}. Expected: ready_for_delivery`,
      });
    }

    // Lockout guard — checked before touching DB again
    if (bookingDoc.otp_failed_attempts >= 5) {
      return res.status(423).json({
        success: false,
        message: "OTP verification locked after 5 failed attempts. Please contact support.",
        locked: true,
      });
    }

    // OTP presence guard
    if (bookingDoc.deliveryOtp == null) {
      return res.status(409).json({
        success: false,
        message: "Delivery OTP not present or already used.",
      });
    }

    const storedOtp = String(bookingDoc.deliveryOtp).trim();

    // ── OTP MISMATCH ───────────────────────────────────────────────────────────
    if (incoming !== storedOtp) {
      bookingDoc.otp_failed_attempts += 1;
      await bookingDoc.save();
      const remaining = 5 - bookingDoc.otp_failed_attempts;
      return res.status(401).json({
        success: false,
        message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
        attempts_remaining: remaining,
      });
    }

    // ── OTP MATCHED — close the booking ───────────────────────────────────────
    bookingDoc.deliveryOtp          = null;
    bookingDoc.otp_verified         = true;
    bookingDoc.delivered_at         = new Date();
    bookingDoc.status               = "delivered";
    await bookingDoc.save();

    console.log(`[VERIFY-OTP] Booking ${bookingId} → delivered`);

    // Rewards / loyalty
    try {
      await handleBookingCompletion(bookingDoc);
    } catch (rewardErr) {
      console.error("[VERIFY-OTP] handleBookingCompletion error:", rewardErr.message);
    }

    // Push "Bike Delivered" to user
    try {
      const user = await Customer.findById(bookingDoc.user_id)
        .select("device_token ftoken")
        .lean();
      const userToken = user?.device_token || user?.ftoken;
      if (userToken) {
        await sendBookingNotification({
          token: userToken,
          title: "Bike Delivered",
          body: "Your bike has been handed over. Ride safe!",
          data: { type: "bike_delivered", bookingId: bookingId.toString() },
          receiverId: bookingDoc.user_id,
          receiverType: "user",
          bookingId: bookingDoc._id,
        });
      }
    } catch (notifyErr) {
      console.error("[VERIFY-OTP] User FCM error:", notifyErr.message);
    }

    // Socket emit to user room
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${bookingDoc.user_id}`).emit("booking:delivered", {
        bookingId,
        status: "delivered",
        delivered_at: bookingDoc.delivered_at,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery OTP verified. Bike delivered successfully.",
      data: {
        bookingId,
        status: "delivered",
        delivered_at: bookingDoc.delivered_at,
      },
    });
  } catch (error) {
    console.error("[VERIFY-OTP] Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 5. Dealer regenerates delivery OTP (customer didn't receive it)
// POST /bookings/:bookingId/regenerate-delivery-otp  { user_id }
const regenerateDeliveryOtp = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { user_id } = req.body;

    if (!bookingId || !user_id) {
      return res.status(400).json({
        success: false,
        message: "bookingId (param) and user_id (body) are required",
      });
    }

    const bookingDoc = await booking.findById(bookingId);
    if (!bookingDoc) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Dealer-only guard
    if (bookingDoc.dealer_id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned dealer can regenerate the OTP",
      });
    }

    // Status guard
    if (bookingDoc.status !== "ready_for_delivery") {
      return res.status(400).json({
        success: false,
        message: `OTP can only be regenerated when status is ready_for_delivery. Current: ${bookingDoc.status}`,
      });
    }

    // Rate limit guard
    if (bookingDoc.otp_regen_count >= 5) {
      return res.status(429).json({
        success: false,
        message: "Maximum OTP regeneration limit (5) reached. Please contact support.",
        regens_used: 5,
        regens_remaining: 0,
      });
    }

    const freshOtp = genOtp();
    bookingDoc.deliveryOtp      = freshOtp;
    bookingDoc.otp_regen_count += 1;
    await bookingDoc.save();

    console.log(`[REGEN-OTP] Booking ${bookingId} | regen #${bookingDoc.otp_regen_count}`);

    // Push new OTP to user — in data payload only
    try {
      const user = await Customer.findById(bookingDoc.user_id)
        .select("device_token ftoken")
        .lean();
      const userToken = user?.device_token || user?.ftoken;
      if (userToken) {
        await sendBookingNotification({
          token: userToken,
          title: "New Handover OTP",
          body: "A new OTP has been generated for your bike handover.",
          data: {
            type: "otp_regenerated",
            bookingId: bookingId.toString(),
            otp: String(freshOtp),
          },
          receiverId: bookingDoc.user_id,
          receiverType: "user",
          bookingId: bookingDoc._id,
        });
      }
    } catch (notifyErr) {
      console.error("[REGEN-OTP] User FCM error:", notifyErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "New OTP sent to customer.",
      data: {
        bookingId,
        regens_used: bookingDoc.otp_regen_count,
        regens_remaining: 5 - bookingDoc.otp_regen_count,
      },
    });
  } catch (error) {
    console.error("[REGEN-OTP] Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

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
  verifyOtpForMobile,
  cancelBooking,
  getBookingTimerStatus,
  serviceComplete,
  selectPaymentMethod,
  confirmCashReceived,
  verifyDeliveryOtp,
  regenerateDeliveryOtp,
}

