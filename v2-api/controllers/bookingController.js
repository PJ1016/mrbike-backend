const BookingV2 = require("../models/BookingV2");
const Vendor = require("../../models/dealerModel");

// 1. Create Booking
exports.createBooking = async (req, res) => {
  try {
    console.log("=== V2 Create Booking Request ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const {
      dealer_id,
      services,
      additionalServices,
      userBike_id,
      scheduleDate,
      timeSlot,
      pickupDate,
      pickupAddress,
      pickupAndDropId,
      estimated_cost,
    } = req.body;

    // Validate required fields
    if (!dealer_id || !services || services.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Dealer and at least one service are required",
      });
    }

    if (!userBike_id) {
      return res.status(400).json({
        status: false,
        message: "User bike is required",
      });
    }

    // Get user from token
    const jwt_decode = require("jwt-decode");
    const token = req.headers.token;
    if (!token) {
      return res.status(401).json({
        status: false,
        message: "Authentication token required",
      });
    }

    const decodedToken = jwt_decode(token);
    const userId = decodedToken.user_id;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Invalid token",
      });
    }

    // Fetch service details to calculate pricing
    const AdminService = require("../../models/adminService");
    const serviceDocs = await AdminService.find({ _id: { $in: services } });

    if (serviceDocs.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No valid services found",
      });
    }

    // Calculate totals
    let subtotal = 0;
    const items = serviceDocs.map((svc) => {
      subtotal += svc.price || 0;
      return {
        serviceId: svc._id,
        serviceName: svc.serviceName || svc.name,
        bikeName: "Bike", // You might want to fetch this from userBike_id
        price: svc.price || 0,
      };
    });

    const tax = Math.round(subtotal * 0.05); // 5% tax
    const grandTotal = subtotal + tax;

    // Generate OTP
    const otp = String(Math.floor(1000 + Math.random() * 9000));

    // Create booking with transformed payload
    const booking = new BookingV2({
      userId,
      dealerId: dealer_id,
      items,
      logistics: {
        mode: pickupAddress ? "pickup" : "self-drop",
        pickupCharges: pickupAddress ? 100 : 0, // Example: 100 for pickup
        address: pickupAddress || "",
      },
      schedule: {
        date: scheduleDate,
        timeSlot: timeSlot,
      },
      totals: {
        subtotal,
        tax,
        grandTotal,
      },
      otp,
    });

    await booking.save();

    console.log("Booking created:", booking.bookingId);

    res.status(201).json({
      status: true,
      message: "Booking created successfully",
      bookingId: booking.bookingId,
      data: {
        currentStatus: booking.status,
        createdAt: booking.createdAt,
      },
      pickupOtp: otp,
      deliveryOtp: otp,
    });
  } catch (error) {
    console.error("Create Booking Error:", error);
    res.status(400).json({
      status: false,
      message: "Invalid Payload",
      error: error.message,
    });
  }
};

// 2. Get User Bookings
exports.getUserBookings = async (req, res) => {
  try {
    const { userId } = req.params;
    const bookings = await BookingV2.find({ userId })
      .populate("dealerId", "shopName")
      .sort({ createdAt: -1 });

    const formattedBookings = bookings.map((b) => ({
      bookingId: b.bookingId,
      dealerName: b.dealerId ? b.dealerId.shopName : "Unknown Dealer",
      status: b.status,
      grandTotal: b.totals.grandTotal,
      date: b.schedule.date,
      itemsCount: b.items.length,
    }));

    res.status(200).json({
      status: true,
      count: formattedBookings.length,
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error("Get User Bookings Error:", error);
    res.status(500).json({
      status: false,
      message: "Server Error",
    });
  }
};

// 3. Verify OTP (Dealer Side)
exports.verifyOtp = async (req, res) => {
  try {
    const { bookingId, otp, dealerId } = req.body;

    const booking = await BookingV2.findOne({ bookingId, dealerId });

    if (!booking) {
      return res.status(404).json({
        status: false,
        message: "Booking Not Found",
      });
    }

    if (booking.otp !== otp) {
      return res.status(403).json({
        status: false,
        message: "Invalid OTP",
      });
    }

    // Update status and timeline
    booking.status = "picked-up";
    const timelineEntry = booking.timeline.find((t) => t.status === "picked-up");
    if (timelineEntry) {
      timelineEntry.time = new Date();
      timelineEntry.completed = true;
    }

    await booking.save();

    res.status(200).json({
      status: true,
      message: "Handover verified. Service started.",
      newStatus: booking.status,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({
      status: false,
      message: "Server Error",
    });
  }
};

// 4. Update Booking Status
exports.updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, comment, additionalCharges } = req.body;

    const booking = await BookingV2.findOne({ bookingId });

    if (!booking) {
      return res.status(404).json({
        status: false,
        message: "Booking Not Found",
      });
    }

    booking.status = status;
    if (additionalCharges) {
      booking.additionalCharges = additionalCharges;
      booking.totals.grandTotal += additionalCharges;
    }

    // Update timeline
    const timelineEntry = booking.timeline.find((t) => t.status === status);
    if (timelineEntry) {
      timelineEntry.time = new Date();
      timelineEntry.completed = true;
      if (comment) timelineEntry.comment = comment;
    } else {
        // If status is not in predefined timeline, add it or just update current status
        // For simplicity, we assume predefined statuses are used
    }

    await booking.save();

    res.status(200).json({
      status: true,
      message: `Booking status updated to ${status}`,
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({
      status: false,
      message: "Server Error",
    });
  }
};

// 5. Get Booking Details (Tracking)
exports.getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await BookingV2.findOne({ bookingId })
      .populate("dealerId", "phone shopName")
      .populate("userId", "name phone");

    if (!booking) {
      return res.status(404).json({
        status: false,
        message: "Booking Not Found",
      });
    }

    res.status(200).json({
      status: true,
      data: {
        bookingId: booking.bookingId,
        timeline: booking.timeline,
        garageContact: booking.dealerId ? booking.dealerId.phone : "N/A",
        items: booking.items,
        bill: {
          subtotal: booking.totals.subtotal,
          logistics: booking.logistics.pickupCharges,
          additionalCharges: booking.additionalCharges,
          tax: booking.totals.tax,
          grandTotal: booking.totals.grandTotal,
        },
      },
    });
  } catch (error) {
    console.error("Get Booking Details Error:", error);
    res.status(500).json({
      status: false,
      message: "Server Error",
    });
  }
};
