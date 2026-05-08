const BookingV2 = require("../models/BookingV2");
const Vendor = require("../../models/dealerModel");

// 1. Create Booking
exports.createBooking = async (req, res) => {
  try {
    console.log("=== V2 Create Booking ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const { userId, dealerId, items, logistics, schedule, totals, otp } = req.body;

    // Validate required fields
    if (!dealerId) {
      return res.status(400).json({
        status: false,
        message: "Dealer and at least one service are required",
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Dealer and at least one service are required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        status: false,
        message: "User ID is required",
      });
    }

    if (!schedule || !schedule.date || !schedule.timeSlot) {
      return res.status(400).json({
        status: false,
        message: "Schedule date and time slot are required",
      });
    }

    if (!totals || totals.grandTotal === undefined) {
      return res.status(400).json({
        status: false,
        message: "Totals are required",
      });
    }

    if (!otp) {
      return res.status(400).json({
        status: false,
        message: "OTP is required",
      });
    }

    const booking = new BookingV2({
      userId,
      dealerId,
      items,
      logistics: logistics || { mode: "self-drop", pickupCharges: 0 },
      schedule,
      totals,
      otp,
    });

    await booking.save();

    console.log("Booking created successfully:", booking.bookingId);

    res.status(201).json({
      status: true,
      message: "Booking created successfully",
      bookingId: booking.bookingId,
      data: {
        currentStatus: booking.status,
        createdAt: booking.createdAt,
      },
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
