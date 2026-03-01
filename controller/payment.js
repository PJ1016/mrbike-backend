var crypto = require('crypto');
const jwt_decode = require("jwt-decode");
const { type } = require("os");
const Booking = require("../models/Booking");
// const Booking = require("../models/Booking");
const sdk = require('api')('@cashfreedocs-new/v3#4xc3n730larv4wbt');
var Tracking = require("../models/Tracking");
const { default: axios } = require("axios");
var Payment = require("../models/Payment");
const customers = require("../models/customer_model");
// const Dealer = require("../models/Dealer");
const Dealer = require("../models/dealerModel");
const Card = require("../models/cardModel");
const Wallet = require("../models/Wallet_modal")
const Razorpay = require('razorpay');
const { method } = require('lodash');
const contacts = require("../models/Contact_model")
const FundAccount = require("../models/FundAccount_model")
const CryptoJS = require('crypto-js');
const QRCode = require('qrcode');
const API_KEY_ID = process.env.API_KEY_ID_RAZO;
const API_KEY_SECRET = process.env.API_KEY_SECRET_RAZO;
const Vendor = require("../models/Dealer");
const Customer = require("../models/customer_model");
const Bill = require("../models/billSchema");

const CASHFREE_BASE_URL =
    process.env.CASHFREE_ENV === "production"
        ? "https://api.cashfree.com/pg/orders"
        : "https://sandbox.cashfree.com/pg/orders";

// Initiate Payment
const initiatePayment = async (req, res) => {
    try {
        // Temporary data
        const booking_id = "68fc8781a2bb1e138c0e0e04";
        const dealer_id = "68d8dbbd1b6028afae8ee02b";
        const user_id = "688cd4088e19dcba2bcff2b7";
        const orderAmount = 1200;
        const payment_by = "user";
        const payment_type = "ONLINE";

        const orderId = `ORD_${Date.now()}`;

        const payload = {
            order_id: orderId,
            order_amount: orderAmount,
            order_currency: "INR",
            customer_details: {
                customer_id: user_id,
                customer_email: "user@example.com",
                customer_phone: "9999999999",
            },
            order_meta: {
                return_url: `https://yourfrontend.com/payment-success?order_id={order_id}`,
                notify_url: `https://yourbackend.com/api/payments/webhook`,
            },
        };

        const response = await axios.post(CASHFREE_BASE_URL, payload, {
            headers: {
                "x-client-id": process.env.APP_ID,
                "x-client-secret": process.env.SECRET_KEY,
                "x-api-version": "2022-09-01",
                "Content-Type": "application/json",
            },
        });

        const data = response.data;

        // Normalize status & token
        const orderStatus = data.order_status === "ACTIVE" ? "PENDING" : data.order_status;
        const orderToken = data.order_token || "temp_token";

        const payment = await Payment.create({
            cf_order_id: data.cf_order_id,
            orderId,
            booking_id,
            dealer_id,
            user_id,
            orderAmount,
            payment_type,
            order_currency: "INR",
            order_status: orderStatus,
            order_token: orderToken,
            payment_by,
        });

        res.status(200).json({
            success: true,
            message: "Payment initiated successfully",
            data: {
                orderId,
                cf_order_id: data.cf_order_id,
                payment_session_id: data.payment_session_id,
                order_status: orderStatus,
                paymentLink: data.payment_link,
            },
        });
    } catch (error) {
        console.error("Payment initiation error:", error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: "Payment initiation failed",
            error: error.response?.data || error.message,
        });
    }
};


const paymentWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const timestamp = req.headers['x-webhook-timestamp'];
        const body = req.body;

        console.log('🔔 Webhook received:', JSON.stringify(body, null, 2));

        // Extract data from Cashfree webhook
        const orderId = body.data?.order?.order_id;
        const orderStatus = body.data?.order?.order_status;
        const paymentMethod = body.data?.order?.payment_method;
        const transactionId = body.data?.order?.payment_utr;
        const paymentTime = body.data?.order?.payment_time;

        if (!orderId) {
            console.log('❌ Missing orderId in webhook');
            return res.status(400).send("Missing orderId");
        }

        // Find payment record
        const payment = await Payment.findOne({ orderId: orderId });
        if (!payment) {
            console.warn(`❌ Webhook: Payment not found for orderId: ${orderId}`);
            return res.status(404).send("Payment not found");
        }

        console.log(`✅ Payment found: ${orderId}, Current status: ${payment.order_status}`);

        // Map Cashfree status
        let mappedStatus;
        switch (orderStatus) {
            case "PAID":
                mappedStatus = "SUCCESS";
                break;
            case "EXPIRED":
            case "FAILED":
                mappedStatus = "FAILED";
                break;
            case "CANCELLED":
                mappedStatus = "CANCELLED";
                break;
            default:
                mappedStatus = "PENDING";
        }

        console.log(`🔄 Mapping status: ${orderStatus} -> ${mappedStatus}`);

        // Update payment
        payment.order_status = mappedStatus;
        payment.payment_method = paymentMethod || null;
        payment.transaction_id = transactionId || null;
        payment.metadata = payment.metadata || {};
        payment.metadata.webhook_data = body.data;
        payment.metadata.last_webhook_received = new Date();

        await payment.save();
        console.log(`✅ Payment updated in database: ${orderId} -> ${mappedStatus}`);

        // ✅ NEW: Generate Bill if payment is successful
        if (mappedStatus === "SUCCESS") {
            await generateBill(payment);
        }

        // Update booking if payment successful
        if (mappedStatus === "SUCCESS") {
            await Booking.findByIdAndUpdate(payment.booking_id, {
                $set: {
                    billStatus: "paid",
                    status: "confirmed",
                    paymentStatus: "completed",
                    paymentDate: new Date(paymentTime || Date.now())
                },
            });
            console.log(`✅ Booking updated: ${payment.booking_id}`);
        }

        console.log(`🎉 Webhook processed successfully: orderId=${orderId}, status=${mappedStatus}`);
        res.status(200).send("Webhook processed successfully");

    } catch (error) {
        console.error("❌ Webhook processing error:", error);
        res.status(500).send("Server error");
    }
};

// ✅ NEW: Bill Generation Function
const generateBill = async (payment) => {
    try {
        // Check if bill already exists
        const existingBill = await Bill.findOne({ booking_id: payment.booking_id });
        if (existingBill) {
            console.log(`📄 Bill already exists for booking: ${payment.booking_id}`);
            return existingBill;
        }

        // Get booking details with populated data
        const booking = await Booking.findById(payment.booking_id)
            .populate("user_id", "first_name last_name email phone")
            .populate("userBike_id", "model registration_number vin")
            .populate({
              path: "services",
              model: "AdminService",
              select: "name price"
            })
            .populate("additionalServices", "name price");

        if (!booking) {
            throw new Error("Booking not found for bill generation");
        }

        // Prepare services array
        const services = [];
        let subtotal = 0;

        // Add main services
        if (booking.services && booking.services.length > 0) {
            booking.services.forEach(service => {
                if (service && service.name) {
                    services.push({
                        name: service.name,
                        price: service.price || 0,
                        quantity: 1,
                        total: service.price || 0
                    });
                    subtotal += service.price || 0;
                }
            });
        }

        // Add additional services
        if (booking.additionalServices && booking.additionalServices.length > 0) {
            booking.additionalServices.forEach(service => {
                if (service && service.name) {
                    services.push({
                        name: `Additional: ${service.name}`,
                        price: service.price || 0,
                        quantity: 1,
                        total: service.price || 0
                    });
                    subtotal += service.price || 0;
                }
            });
        }

        // Use serviceSummary if available (fallback)
        if (services.length === 0 && booking.serviceSummary && booking.serviceSummary.length > 0) {
            booking.serviceSummary.forEach(service => {
                if (service.serviceName) {
                    services.push({
                        name: service.serviceName,
                        price: service.price || 0,
                        quantity: 1,
                        total: service.price || 0
                    });
                    subtotal += service.price || 0;
                }
            });
        }

        // Calculate tax and total
        const taxRate = 18; // 18% GST
        const taxAmount = (subtotal * taxRate) / 100;
        const totalAmount = subtotal + taxAmount;

        // Generate bill number
        const billNumber = `BILL-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Create bill
        const bill = new Bill({
            booking_id: payment.booking_id,
            payment_id: payment._id,
            bill_number: billNumber,
            bill_date: new Date(),
            customer_details: {
                name: `${booking.user_id.first_name} ${booking.user_id.last_name}`,
                email: booking.user_id.email,
                phone: booking.user_id.phone
            },
            bike_details: {
                model: booking.userBike_id?.model || "N/A",
                registration: booking.userBike_id?.registration_number || "N/A",
                vin: booking.userBike_id?.vin || "N/A"
            },
            services: services,
            subtotal: subtotal,
            tax_amount: taxAmount,
            tax_rate: taxRate,
            total_amount: totalAmount,
            payment_details: {
                payment_method: payment.payment_method || "online",
                transaction_id: payment.transaction_id,
                payment_date: new Date()
            },
            status: "generated"
        });

        await bill.save();
        console.log(`✅ Bill generated successfully: ${billNumber} for booking: ${payment.booking_id}`);

        // Update booking with bill generated flag
        await Booking.findByIdAndUpdate(payment.booking_id, {
            $set: {
                billGenerated: true,
                totalBill: totalAmount,
                tax: taxAmount
            }
        });

        return bill;

    } catch (error) {
        console.error("❌ Bill generation error:", error);
        throw error;
    }
};

// Get Bill by Booking ID
const getBillByBookingId = async (req, res) => {
    try {
        const { booking_id } = req.params;

        const bill = await Bill.findOne({ booking_id: booking_id })
            .populate("booking_id")
            .populate("payment_id");

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found for this booking"
            });
        }

        res.status(200).json({
            success: true,
            message: "Bill fetched successfully",
            data: bill
        });

    } catch (error) {
        console.error("Get Bill Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch bill",
            error: error.message
        });
    }
};

// Get All Bills with Filtering
const getAllBills = async (req, res) => {
    try {
        const { page = 1, limit = 10, startDate, endDate } = req.query;

        const filters = {};

        // Date range filter
        if (startDate || endDate) {
            filters.bill_date = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                filters.bill_date.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filters.bill_date.$lte = end;
            }
        }

        const bills = await Bill.find(filters)
            .populate("booking_id")
            .populate("payment_id")
            .sort({ bill_date: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalBills = await Bill.countDocuments(filters);

        res.status(200).json({
            success: true,
            message: "Bills fetched successfully",
            data: {
                bills,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalBills / limit),
                    totalBills
                }
            }
        });

    } catch (error) {
        console.error("Get All Bills Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch bills",
            error: error.message
        });
    }
};

// Handle Cashfree webhook to update payment status
// const paymentWebhook = async (req, res) => {
//     try {
//         // const data = req.body;

//         // const { order_id, order_status, order_token } = data;

//         const order_id = "ORD_1762157489304";
//         const order_status = "SUCCESS";
//         const order_token = "temp_token";

//         if (!order_id) {
//             return res.status(400).json({ success: false, message: "Missing order_id" });
//         }

//         // Map Cashfree statuses to your enum
//         let mappedStatus;
//         switch (order_status) {
//             case "SUCCESS":
//                 mappedStatus = "SUCCESS";
//                 break;
//             case "FAILED":
//                 mappedStatus = "FAILED";
//                 break;
//             case "CANCELLED":
//                 mappedStatus = "CANCELLED";
//                 break;
//             case "ACTIVE": // just in case
//             case "PENDING":
//                 mappedStatus = "PENDING";
//                 break;
//             default:
//                 mappedStatus = "PENDING";
//         }

//         // Update the payment in DB
//         const updatedPayment = await Payment.findOneAndUpdate(
//             { orderId: order_id },
//             {
//                 order_status: mappedStatus,
//                 order_token: order_token || "temp_token",
//             },
//             { new: true }
//         );

//         if (!updatedPayment) {
//             return res.status(404).json({ success: false, message: "Payment not found" });
//         }

//         // Optional: trigger other actions, e.g., mark booking as paid
//         // await Booking.findByIdAndUpdate(updatedPayment.booking_id, { billStatus: "paid" });

//         console.log(`Webhook processed: order_id=${order_id}, status=${mappedStatus}`);

//         res.status(200).send("Webhook received"); // Cashfree expects 200 response
//     } catch (error) {
//         console.error("Webhook error:", error);
//         res.status(500).send("Server error");
//     }
// };

//  Get single payment details
const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;

        // Find by MongoDB _id OR orderId
        let payment = await Payment.findById(id)
            .populate({
                path: "booking_id",
                select: "bookingId totalBill status serviceDate",
                options: { strictPopulate: false },
            })
            .populate("dealer_id", "name email")
            .populate("user_id", "name email");

        // If not found by _id, try finding by orderId
        if (!payment) {
            payment = await Payment.findOne({ orderId: id })
                .populate({
                    path: "booking_id",
                    select: "bookingId totalBill status serviceDate",
                    options: { strictPopulate: false },
                })
                .populate("dealer_id", "name email")
                .populate("user_id", "name email");
        }

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Payment fetched successfully",
            data: payment,
        });
    } catch (error) {
        console.error("Error fetching payment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payment",
            error: error.message,
        });
    }
};

// Get All Payments 
const getAllPayments = async (req, res) => {
    try {
        // 🔍 Build filters dynamically
        const filters = {};

        // Status filter
        if (req.query.status) {
            filters.order_status = req.query.status.trim().toUpperCase();
        }

        // Dealer filter
        if (req.query.dealer_id) {
            filters.dealer_id = req.query.dealer_id;
        }

        // User filter
        if (req.query.user_id) {
            filters.user_id = req.query.user_id;
        }

        // Date range filter (optional)
        if (req.query.startDate && req.query.endDate) {
            const start = new Date(req.query.startDate);
            const end = new Date(req.query.endDate);
            if (!isNaN(start) && !isNaN(end)) {
                end.setHours(23, 59, 59, 999);
                filters.createdAt = { $gte: start, $lte: end };
            }
        }

        // 🕒 Sort (latest first)
        const sort = { createdAt: -1 };

        // 📦 Fetch all records (no skip/limit)
        const payments = await Payment.find(filters)
            .populate({
                path: "booking_id",
                select: "bookingId totalBill status serviceDate",
                options: { strictPopulate: false },
            })
            .populate("dealer_id", "name email")
            .populate("user_id", "first_name last_name email")
            .sort(sort)
            .lean();

        // 🧾 Send response
        res.status(200).json({
            success: true,
            message: "All payments fetched successfully",
            totalRecords: payments.length,
            data: payments,
        });

    } catch (error) {
        console.error("❌ Error fetching all payments:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payments",
            error: error.message,
        });
    }
};

const createCheckoutUrl = async (req, res) => {
    try {
        console.log("Cashfree Credentials Check:", {
            hasAppId: !!process.env.APP_ID,
            hasSecretKey: !!process.env.SECRET_KEY,
            appIdLength: process.env.APP_ID ? process.env.APP_ID.length : 0,
            secretKeyLength: process.env.SECRET_KEY ? process.env.SECRET_KEY.length : 0,
            env: process.env.CASHFREE_ENV
        });

        const {
            orderAmount,
            orderCurrency = "INR",
            user_id,
            dealer_id,
            booking_id,
            customer_email,
            customer_phone,
            customer_name,
            payment_type = "ONLINE",
            payment_by = "user",
        } = req.body;

        if (!orderAmount || !user_id || !dealer_id || !booking_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
            });
        }

        // Check if credentials exist
        if (!process.env.APP_ID || !process.env.SECRET_KEY) {
            return res.status(500).json({
                success: false,
                message: "Cashfree credentials not configured",
                debug: {
                    APP_ID: process.env.APP_ID ? "***" + process.env.APP_ID.slice(-4) : "MISSING",
                    SECRET_KEY: process.env.SECRET_KEY ? "***" + process.env.SECRET_KEY.slice(-4) : "MISSING"
                }
            });
        }

        const orderId = `ORD_${Date.now()}`;
        // const returnUrl = `https://dr-bike-backend.onrender.com/payment-success?order_id={order_id}`;
        const returnUrl = `http://localhost:8001/payment-success?order_id={order_id}`;
        // const notifyUrl = `https://dr-bike-backend.onrender.com/api/payments/webhook`;
        const notifyUrl = `http://localhost:8001/api/payments/webhook`;

        const payload = {
            order_id: orderId,
            order_amount: parseFloat(orderAmount),
            order_currency: orderCurrency,
            customer_details: {
                customer_id: user_id,
                customer_name: customer_name || "Customer",
                customer_email: customer_email || "customer@example.com",
                customer_phone: customer_phone || "9999999999",
            },
            order_meta: {
                return_url: returnUrl,
                notify_url: notifyUrl,
            },
        };

        console.log("Making request to Cashfree with credentials:", {
            appId: "***" + process.env.APP_ID.slice(-4),
            baseUrl: CASHFREE_BASE_URL
        });

        // Make API call to Cashfree
        const response = await axios.post(CASHFREE_BASE_URL, payload, {
            headers: {
                "x-client-id": process.env.APP_ID,
                "x-client-secret": process.env.SECRET_KEY,
                "x-api-version": "2022-09-01",
                "Content-Type": "application/json",
            },
        });

        const data = response.data;

        // Handle order token and status
        const orderToken = data.order_token || `temp_token_${Date.now()}`;
        const orderStatus = data.order_status === "ACTIVE" ? "PENDING" : data.order_status;

        // Create payment record
        await Payment.create({
            cf_order_id: data.cf_order_id,
            orderId,
            booking_id,
            dealer_id,
            user_id,
            orderAmount,
            payment_type,
            order_currency: orderCurrency,
            order_status: orderStatus,
            order_token: orderToken,
            payment_by,
        });

        let checkoutUrl;
        if (data.payment_link) {
            checkoutUrl = data.payment_link;
        } else if (data.payment_session_id) {
            checkoutUrl = `https://sandbox.cashfree.com/order/#${data.payment_session_id}`;
        } else {
            checkoutUrl = null;
        }

        return res.status(200).json({
            success: true,
            message: "Checkout URL created successfully",
            data: {
                checkout_url: checkoutUrl,
                orderId,
                cf_order_id: data.cf_order_id,
                order_status: orderStatus,
            }
        });

    } catch (error) {
        console.error("Cashfree Authentication Error:", {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });

        return res.status(500).json({
            success: false,
            message: "Cashfree authentication failed - check your credentials",
            error: error.response?.data || error.message,
        });
    }
};

const createCheckoutSession = async (req, res) => {
    try {
        const {
            amount,
            user_id,
            dealer_id,
            booking_id,
            customer_email,
            customer_phone,
            customer_name = "Customer"
        } = req.body;

        // Validate required fields
        if (!amount || !user_id || !dealer_id || !booking_id || !customer_email) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: amount, user_id, dealer_id, booking_id, customer_email"
            });
        }

        // Verify booking exists
        const booking = await Booking.findById(booking_id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Cashfree payload with proper return URLs
        const payload = {
            order_id: orderId,
            order_amount: parseFloat(amount),
            order_currency: "INR",
            customer_details: {
                customer_id: user_id,
                customer_name: customer_name,
                customer_email: customer_email,
                customer_phone: customer_phone || "9999999999",
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback?order_id={order_id}&order_token={order_token}`,
                notify_url: `${process.env.BACKEND_URL || 'http://localhost:8001'}/api/payments/webhook`,
            },
            order_note: `Payment for booking ${booking_id}`
        };

        // Make API call to Cashfree
        const response = await axios.post(CASHFREE_BASE_URL, payload, {
            headers: {
                "x-client-id": process.env.CASHFREE_APP_ID,
                "x-client-secret": process.env.CASHFREE_SECRET_KEY,
                "x-api-version": "2022-09-01",
                "Content-Type": "application/json",
            },
        });

        const cashfreeData = response.data;

        // Create payment record in database
        const payment = await Payment.create({
            cf_order_id: cashfreeData.cf_order_id,
            orderId: orderId,
            booking_id: booking_id,
            dealer_id: dealer_id,
            user_id: user_id,
            orderAmount: amount,
            payment_type: "ONLINE",
            order_currency: "INR",
            order_status: cashfreeData.order_status === "ACTIVE" ? "PENDING" : cashfreeData.order_status,
            order_token: cashfreeData.order_token || "temp_token",
            payment_by: "user",
        });

        // Construct the checkout URL
        const checkoutUrl = cashfreeData.payment_link ||
            `https://${process.env.CASHFREE_ENV === 'production' ? 'payments.cashfree.com' : 'sandbox.cashfree.com'}/pg/orders/${orderId}/payments`;

        // Success response
        res.status(200).json({
            success: true,
            message: "Checkout session created successfully",
            data: {
                order_id: orderId,
                cf_order_id: cashfreeData.cf_order_id,
                payment_session_id: cashfreeData.payment_session_id,
                order_status: "PENDING",
                checkout_url: checkoutUrl,
                amount: amount,
                currency: "INR",
                expires_at: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes expiry
            }
        });

    } catch (error) {
        console.error("Checkout session creation error:", error.response?.data || error.message);

        res.status(500).json({
            success: false,
            message: "Failed to create checkout session",
            error: error.response?.data || error.message
        });
    }
};

const createPaymentLink = async (req, res) => {
    try {
        const {
            orderAmount,
            orderCurrency = "INR",
            user_id,
            dealer_id,
            booking_id,
            customer_email,
            customer_phone,
            customer_name,
        } = req.body;

        if (!orderAmount || !user_id || !dealer_id || !booking_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields (orderAmount, user_id, dealer_id, booking_id)",
            });
        }

        // 🧠 Update booking immediately — mark payment initiated
        await Booking.findByIdAndUpdate(booking_id, {
            $set: {
                billStatus: "pending",
                status: "payment",
                totalBill: orderAmount,
            },
        });

        // 🎯 Prepare Cashfree payload
        const payload = {
            customer_details: {
                customer_email: customer_email || "customer@example.com",
                customer_name: customer_name || "Customer",
                customer_phone: customer_phone || "9999999999",
            },
            link_amount: parseFloat(orderAmount),
            link_currency: orderCurrency,
            link_partial_payments: false,
            link_auto_reminders: true,
            link_purpose: "Bike Doctor Service Payment",
            link_notes: { booking_id, user_id, dealer_id },
            link_meta: {
                return_url: "http://localhost:8001/payment-success",
            },
        };

        let paymentData = null;

        try {
            // 💳 Try creating Cashfree payment link
            const response = await axios.post(
                "https://sandbox.cashfree.com/pg/links",
                payload,
                {
                    headers: {
                        "x-client-id": process.env.APP_ID,
                        "x-client-secret": process.env.SECRET_KEY,
                        "x-api-version": "2025-01-01",
                        "Content-Type": "application/json",
                    },
                }
            );

            paymentData = response.data;
        } catch (err) {
            console.error("⚠️ Cashfree link creation failed:", err.response?.data || err.message);
            paymentData = null;
        }

        // 💾 Create Payment Record (Always)
        const payment = await Payment.create({
            booking_id,
            cf_order_id: Date.now(),
            dealer_id,
            user_id,
            orderAmount,
            order_currency: orderCurrency,
            payment_type: "ONLINE",
            order_status: paymentData ? "PENDING" : "FAILED", // depends on Cashfree response
            cf_link_id: paymentData?.cf_link_id || null,
            payment_link: paymentData?.link_url || null,
            create_date: new Date(),
        });

        // ✅ Return proper response
        return res.status(200).json({
            success: true,
            message: paymentData
                ? "Payment link created successfully"
                : "Payment link creation failed, record saved for tracking",
            data: {
                payment_link: paymentData?.link_url || null,
                payment_id: payment._id,
                order_status: payment.order_status,
            },
        });
    } catch (error) {
        console.error("❌ Payment Link Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while creating payment link",
            error: error.message,
        });
    }
};

// Get All Bills for User (Simplified)
const getUserBillsSimple = async (req, res) => {
    try {
        const { user_id } = req.params;

        // Get all bookings for this user
        const userBookings = await Booking.find({ user_id: user_id })
            .select('_id bookingId serviceDate status')
            .populate('userBike_id', 'model registration_number');

        if (userBookings.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No bookings found for this user",
                data: []
            });
        }

        const bookingIds = userBookings.map(booking => booking._id);

        // Get all bills for these bookings
        const bills = await Bill.find({ booking_id: { $in: bookingIds } })
            .populate('payment_id', 'orderId payment_method')
            .sort({ bill_date: -1 })
            .lean();

        // Map bills with booking details
        const billsWithDetails = bills.map(bill => {
            const booking = userBookings.find(b => b._id.toString() === bill.booking_id.toString());
            return {
                bill_id: bill._id,
                bill_number: bill.bill_number,
                bill_date: bill.bill_date,
                booking_id: booking?._id,
                booking_number: booking?.bookingId,
                service_date: booking?.serviceDate,
                bike_model: booking?.userBike_id?.model,
                bike_registration: booking?.userBike_id?.registration_number,
                booking_status: booking?.status,
                customer_name: bill.customer_details?.name,
                total_amount: bill.total_amount,
                payment_method: bill.payment_details?.payment_method,
                bill_status: bill.status
            };
        });

        res.status(200).json({
            success: true,
            message: "User bills fetched successfully",
            data: billsWithDetails
        });

    } catch (error) {
        console.error("Get User Bills Simple Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch user bills",
            error: error.message
        });
    }
};

// Get Bill Details for User (with download format)
const getUserBillDetails = async (req, res) => {
    try {
        const { user_id, bill_id } = req.params;

        // Verify the bill belongs to the user
        const bill = await Bill.findById(bill_id)
            .populate({
                path: "booking_id",
                select: "user_id bookingId serviceDate userBike_id",
                populate: {
                    path: "userBike_id",
                    select: "model registration_number vin year"
                }
            })
            .populate("payment_id", "orderId payment_method transaction_id");

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found"
            });
        }

        // Check if bill belongs to the requested user
        if (bill.booking_id.user_id.toString() !== user_id) {
            return res.status(403).json({
                success: false,
                message: "Access denied. This bill does not belong to you"
            });
        }

        // Format bill for download/view
        const billDetails = {
            bill_id: bill._id,
            bill_number: bill.bill_number,
            bill_date: bill.bill_date,
            booking_number: bill.booking_id.bookingId,
            service_date: bill.booking_id.serviceDate,
            bike_details: {
                model: bill.booking_id.userBike_id?.model,
                registration: bill.booking_id.userBike_id?.registration_number,
                vin: bill.booking_id.userBike_id?.vin,
                year: bill.booking_id.userBike_id?.year
            },
            customer_details: bill.customer_details,
            services: bill.services,
            subtotal: bill.subtotal,
            tax_amount: bill.tax_amount,
            tax_rate: bill.tax_rate,
            total_amount: bill.total_amount,
            payment_details: bill.payment_details,
            bill_status: bill.status,
            created_at: bill.createdAt
        };

        res.status(200).json({
            success: true,
            message: "Bill details fetched successfully",
            data: billDetails
        });

    } catch (error) {
        console.error("Get User Bill Details Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch bill details",
            error: error.message
        });
    }
};

module.exports = { getBillByBookingId, getAllBills, getUserBillsSimple, getUserBillDetails, getAllPayments, initiatePayment, getPaymentById, paymentWebhook, createCheckoutUrl, createCheckoutSession, createPaymentLink };

// const axios = require('axios');
// const Payment = require("../models/Payment");
// const Booking = require("../models/Booking");

// const CASHFREE_BASE_URL = process.env.CASHFREE_ENV === "production"
//     ? "https://api.cashfree.com/pg"
//     : "https://sandbox.cashfree.com/pg";

// class CashfreePaymentService {
//     constructor() {
//         this.headers = {
//             "x-client-id": process.env.APP_ID,
//             "x-client-secret": process.env.SECRET_KEY,
//             "x-api-version": "2022-09-01",
//             "Content-Type": "application/json",
//         };
//     }

//     async createOrder(payload) {
//         try {
//             const response = await axios.post(`${CASHFREE_BASE_URL}/orders`, payload, {
//                 headers: this.headers
//             });
//             return response.data;
//         } catch (error) {
//             console.error("Cashfree API Error:", error.response?.data || error.message);
//             throw new Error(error.response?.data?.message || "Cashfree order creation failed");
//         }
//     }

//     async getOrderStatus(orderId) {
//         try {
//             const response = await axios.get(`${CASHFREE_BASE_URL}/orders/${orderId}`, {
//                 headers: this.headers
//             });
//             return response.data;
//         } catch (error) {
//             console.error("Cashfree Status Check Error:", error.response?.data || error.message);
//             throw new Error("Failed to fetch order status");
//         }
//     }
// }

// const paymentService = new CashfreePaymentService();

// // Create Payment Order
// // const createPaymentOrder = async (req, res) => {
// //     try {
// //         const {
// //             orderAmount,
// //             user_id,
// //             dealer_id,
// //             booking_id,
// //             customer_email,
// //             customer_phone,
// //             customer_name,
// //             payment_type = "ONLINE",
// //             payment_by = "user",
// //             orderCurrency = "INR"
// //         } = req.body;

// //         // Validation
// //         if (!orderAmount || !user_id || !dealer_id || !booking_id || !customer_email) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Missing required fields: orderAmount, user_id, dealer_id, booking_id, customer_email"
// //             });
// //         }

// //         if (orderAmount < 1) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Order amount must be at least 1"
// //             });
// //         }

// //         // Check if booking exists
// //         const booking = await Booking.findById(booking_id);
// //         if (!booking) {
// //             return res.status(404).json({
// //                 success: false,
// //                 message: "Booking not found"
// //             });
// //         }

// //         // Generate unique order ID
// //         const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// //         // Prepare Cashfree payload
// //         const payload = {
// //             order_id: orderId,
// //             order_amount: parseFloat(orderAmount),
// //             order_currency: orderCurrency,
// //             customer_details: {
// //                 customer_id: user_id,
// //                 customer_name: customer_name || "Customer",
// //                 customer_email: customer_email,
// //                 customer_phone: customer_phone || "9999999999",
// //             },
// //             order_meta: {
// //                 return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback?order_id={order_id}`,
// //                 notify_url: `${process.env.BACKEND_URL || 'http://localhost:8001'}/api/payments/webhook`,
// //             },
// //             order_note: `Payment for booking ${booking_id}`
// //         };

// //         // Create order in Cashfree
// //         const cashfreeResponse = await paymentService.createOrder(payload);

// //         // Map Cashfree status to internal status
// //         const orderStatus = cashfreeResponse.order_status === "ACTIVE" ? "PENDING" : cashfreeResponse.order_status;

// //         // Create payment record
// //         const payment = await Payment.create({
// //             cf_order_id: cashfreeResponse.cf_order_id,
// //             orderId: orderId,
// //             booking_id: booking_id,
// //             dealer_id: dealer_id,
// //             user_id: user_id,
// //             orderAmount: orderAmount,
// //             payment_type: payment_type,
// //             order_currency: orderCurrency,
// //             order_status: orderStatus,
// //             order_token: cashfreeResponse.order_token || null,
// //             payment_by: payment_by,
// //             metadata: {
// //                 session_id: cashfreeResponse.payment_session_id,
// //                 cashfree_response: cashfreeResponse
// //             }
// //         });

// //         // Update booking status
// //         await Booking.findByIdAndUpdate(booking_id, {
// //             $set: {
// //                 billStatus: "pending",
// //                 status: "payment_initiated",
// //                 totalBill: orderAmount,
// //             },
// //         });

// //         // Construct checkout URL
// //         const checkoutUrl = cashfreeResponse.payment_session_id
// //             ? `https://${process.env.CASHFREE_ENV === 'production' ? 'payments.cashfree.com' : 'sandbox.cashfree.com'}/order/#${cashfreeResponse.payment_session_id}`
// //             : cashfreeResponse.payment_link;

// //         res.status(200).json({
// //             success: true,
// //             message: "Payment order created successfully",
// //             data: {
// //                 order_id: orderId,
// //                 cf_order_id: cashfreeResponse.cf_order_id,
// //                 payment_session_id: cashfreeResponse.payment_session_id,
// //                 order_status: orderStatus,
// //                 checkout_url: checkoutUrl,
// //                 order_amount: orderAmount,
// //                 currency: orderCurrency,
// //                 expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
// //                 payment_id: payment._id
// //             }
// //         });

// //     } catch (error) {
// //         console.error("Create Payment Order Error:", error);
// //         res.status(500).json({
// //             success: false,
// //             message: "Failed to create payment order",
// //             error: error.message
// //         });
// //     }
// // };

// const createPaymentOrder = async (req, res) => {
//     try {
//         const {
//             orderAmount,
//             user_id,
//             dealer_id,
//             booking_id,
//             customer_email,
//             customer_phone,
//             customer_name,
//             payment_type = "ONLINE",
//             payment_by = "user",
//             orderCurrency = "INR"
//         } = req.body;

//         // Validation
//         if (!orderAmount || !user_id || !dealer_id || !booking_id || !customer_email) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Missing required fields: orderAmount, user_id, dealer_id, booking_id, customer_email"
//             });
//         }

//         if (orderAmount < 1) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Order amount must be at least 1"
//             });
//         }

//         // Check if booking exists
//         const booking = await Booking.findById(booking_id);
//         if (!booking) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Booking not found"
//             });
//         }

//         // ✅ NEW: Check for existing successful payment
//         const existingSuccessPayment = await Payment.findOne({
//             booking_id: booking_id,
//             order_status: "SUCCESS"
//         });

//         if (existingSuccessPayment) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Payment already completed for this booking",
//                 data: {
//                     existing_payment_id: existingSuccessPayment._id,
//                     order_id: existingSuccessPayment.orderId,
//                     amount: existingSuccessPayment.orderAmount,
//                     status: existingSuccessPayment.order_status,
//                     payment_date: existingSuccessPayment.updatedAt
//                 }
//             });
//         }

//         // ✅ NEW: Check for pending payment
//         const existingPendingPayment = await Payment.findOne({
//             booking_id: booking_id,
//             order_status: "PENDING"
//         });

//         if (existingPendingPayment) {
//             const checkoutUrl = existingPendingPayment.metadata?.session_id
//                 ? `https://${process.env.CASHFREE_ENV === 'production' ? 'payments.cashfree.com' : 'sandbox.cashfree.com'}/order/#${existingPendingPayment.metadata.session_id}`
//                 : null;

//             return res.status(400).json({
//                 success: false,
//                 message: "Pending payment already exists for this booking",
//                 data: {
//                     pending_payment_id: existingPendingPayment._id,
//                     order_id: existingPendingPayment.orderId,
//                     checkout_url: checkoutUrl,
//                     created_at: existingPendingPayment.createdAt,
//                     expires_at: new Date(existingPendingPayment.createdAt.getTime() + 30 * 60 * 1000) // 30 minutes
//                 }
//             });
//         }

//         // ✅ NEW: Check for recently failed payment (within 5 minutes)
//         const recentFailedPayment = await Payment.findOne({
//             booking_id: booking_id,
//             order_status: "FAILED",
//             createdAt: {
//                 $gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
//             }
//         });

//         if (recentFailedPayment) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Please wait 5 minutes before retrying failed payment",
//                 data: {
//                     failed_payment_id: recentFailedPayment._id,
//                     order_id: recentFailedPayment.orderId,
//                     failed_at: recentFailedPayment.updatedAt,
//                     retry_after: new Date(recentFailedPayment.createdAt.getTime() + 5 * 60 * 1000)
//                 }
//             });
//         }

//         // Generate unique order ID
//         const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

//         // Prepare Cashfree payload
//         const payload = {
//             order_id: orderId,
//             order_amount: parseFloat(orderAmount),
//             order_currency: orderCurrency,
//             customer_details: {
//                 customer_id: user_id,
//                 customer_name: customer_name || "Customer",
//                 customer_email: customer_email,
//                 customer_phone: customer_phone || "9999999999",
//             },
//             order_meta: {
//                 return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback?order_id={order_id}`,
//                 notify_url: `${process.env.BACKEND_URL || 'http://localhost:8001'}/api/payments/webhook`,
//             },
//             order_note: `Payment for booking ${booking_id}`
//         };

//         // Create order in Cashfree
//         const cashfreeResponse = await paymentService.createOrder(payload);

//         // Map Cashfree status to internal status
//         const orderStatus = cashfreeResponse.order_status === "ACTIVE" ? "PENDING" : cashfreeResponse.order_status;

//         // Create payment record
//         const payment = await Payment.create({
//             cf_order_id: cashfreeResponse.cf_order_id,
//             orderId: orderId,
//             booking_id: booking_id,
//             dealer_id: dealer_id,
//             user_id: user_id,
//             orderAmount: orderAmount,
//             payment_type: payment_type,
//             order_currency: orderCurrency,
//             order_status: orderStatus,
//             order_token: cashfreeResponse.order_token || null,
//             payment_by: payment_by,
//             metadata: {
//                 session_id: cashfreeResponse.payment_session_id,
//                 cashfree_response: cashfreeResponse,
//                 expires_at: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes expiry
//             }
//         });

//         // Update booking status only if no previous payment exists
//         await Booking.findByIdAndUpdate(booking_id, {
//             $set: {
//                 billStatus: "pending",
//                 status: "payment_initiated",
//                 totalBill: orderAmount,
//             },
//         });

//         // Construct checkout URL
//         const checkoutUrl = cashfreeResponse.payment_session_id
//             ? `https://${process.env.CASHFREE_ENV === 'production' ? 'payments.cashfree.com' : 'sandbox.cashfree.com'}/order/#${cashfreeResponse.payment_session_id}`
//             : cashfreeResponse.payment_link;

//         res.status(200).json({
//             success: true,
//             message: "Payment order created successfully",
//             data: {
//                 order_id: orderId,
//                 cf_order_id: cashfreeResponse.cf_order_id,
//                 payment_session_id: cashfreeResponse.payment_session_id,
//                 order_status: orderStatus,
//                 checkout_url: checkoutUrl,
//                 order_amount: orderAmount,
//                 currency: orderCurrency,
//                 expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
//                 payment_id: payment._id
//             }
//         });

//     } catch (error) {
//         console.error("Create Payment Order Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to create payment order",
//             error: error.message
//         });
//     }
// };

// // Verify Payment Status
// const verifyPayment = async (req, res) => {
//     try {
//         const { order_id } = req.params;

//         if (!order_id) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Order ID is required"
//             });
//         }

//         // Get payment from database
//         const payment = await Payment.findOne({
//             $or: [{ orderId: order_id }, { cf_order_id: order_id }]
//         });

//         if (!payment) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Payment not found"
//             });
//         }

//         // Get latest status from Cashfree
//         const cashfreeStatus = await paymentService.getOrderStatus(payment.orderId);

//         // Map Cashfree status to internal status
//         let mappedStatus = payment.order_status;
//         switch (cashfreeStatus.order_status) {
//             case "PAID":
//                 mappedStatus = "SUCCESS";
//                 break;
//             case "ACTIVE":
//                 mappedStatus = "PENDING";
//                 break;
//             case "EXPIRED":
//                 mappedStatus = "FAILED";
//                 break;
//             default:
//                 mappedStatus = cashfreeStatus.order_status;
//         }

//         // Update payment status if changed
//         if (mappedStatus !== payment.order_status) {
//             payment.order_status = mappedStatus;
//             payment.metadata.last_status_check = new Date();
//             payment.metadata.cashfree_latest_response = cashfreeStatus;

//             await payment.save();

//             // Update booking if payment successful
//             if (mappedStatus === "SUCCESS") {
//                 await Booking.findByIdAndUpdate(payment.booking_id, {
//                     $set: {
//                         billStatus: "paid",
//                         status: "confirmed",
//                         paymentStatus: "completed"
//                     },
//                 });
//             }
//         }

//         res.status(200).json({
//             success: true,
//             message: "Payment status verified",
//             data: {
//                 order_id: payment.orderId,
//                 cf_order_id: payment.cf_order_id,
//                 order_status: payment.order_status,
//                 order_amount: payment.orderAmount,
//                 currency: payment.order_currency,
//                 payment_method: payment.payment_method,
//                 created_at: payment.createdAt,
//                 updated_at: payment.updatedAt
//             }
//         });

//     } catch (error) {
//         console.error("Verify Payment Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to verify payment status",
//             error: error.message
//         });
//     }
// };

// // Enhanced Webhook Handler
// // const paymentWebhook = async (req, res) => {
// //     try {
// //         const signature = req.headers['x-webhook-signature'];
// //         const timestamp = req.headers['x-webhook-timestamp'];
// //         const body = req.body;

// //         // Verify webhook signature (implement based on Cashfree docs)
// //         // const isValid = verifyWebhookSignature(signature, timestamp, body);
// //         // if (!isValid) {
// //         //   return res.status(401).send("Invalid signature");
// //         // }

// //         const { orderId, orderStatus, paymentAmount, paymentMethod, transactionId, paymentTime } = body.data;

// //         if (!orderId) {
// //             return res.status(400).send("Missing orderId");
// //         }

// //         // Find payment record
// //         const payment = await Payment.findOne({ orderId: orderId });
// //         if (!payment) {
// //             console.warn(`Webhook: Payment not found for orderId: ${orderId}`);
// //             return res.status(404).send("Payment not found");
// //         }

// //         // Map Cashfree status
// //         let mappedStatus;
// //         switch (orderStatus) {
// //             case "PAID":
// //                 mappedStatus = "SUCCESS";
// //                 break;
// //             case "EXPIRED":
// //             case "FAILED":
// //                 mappedStatus = "FAILED";
// //                 break;
// //             case "CANCELLED":
// //                 mappedStatus = "CANCELLED";
// //                 break;
// //             default:
// //                 mappedStatus = "PENDING";
// //         }

// //         // Update payment
// //         payment.order_status = mappedStatus;
// //         payment.payment_method = paymentMethod || null;
// //         payment.transaction_id = transactionId || null;
// //         payment.metadata.webhook_data = body.data;
// //         payment.metadata.last_webhook_received = new Date();

// //         await payment.save();

// //         // Update booking if payment successful
// //         if (mappedStatus === "SUCCESS") {
// //             await Booking.findByIdAndUpdate(payment.booking_id, {
// //                 $set: {
// //                     billStatus: "paid",
// //                     status: "confirmed",
// //                     paymentStatus: "completed",
// //                     paymentDate: new Date(paymentTime || Date.now())
// //                 },
// //             });
// //         }

// //         console.log(`Webhook processed: orderId=${orderId}, status=${mappedStatus}`);
// //         res.status(200).send("Webhook processed successfully");

// //     } catch (error) {
// //         console.error("Webhook processing error:", error);
// //         res.status(500).send("Server error");
// //     }
// // };

// const paymentWebhook = async (req, res) => {
//     try {
//         const signature = req.headers['x-webhook-signature'];
//         const timestamp = req.headers['x-webhook-timestamp'];
//         const body = req.body;

//         console.log('🔔 Webhook received:', JSON.stringify(body, null, 2));

//         // YEH LINES CHANGE KARO - Cashfree format ke hisab se
//         const orderId = body.data?.order?.order_id; // Yeh line change
//         const orderStatus = body.data?.order?.order_status; // Yeh line change
//         const paymentMethod = body.data?.order?.payment_method; // Yeh line change
//         const transactionId = body.data?.order?.payment_utr; // Yeh line change
//         const paymentTime = body.data?.order?.payment_time; // Yeh line change
//         const paymentAmount = body.data?.order?.order_amount; // Yeh line change

//         if (!orderId) {
//             console.log('❌ Missing orderId in webhook');
//             return res.status(400).send("Missing orderId");
//         }

//         // Find payment record
//         const payment = await Payment.findOne({ orderId: orderId });
//         if (!payment) {
//             console.warn(`❌ Webhook: Payment not found for orderId: ${orderId}`);
//             return res.status(404).send("Payment not found");
//         }

//         console.log(`✅ Payment found: ${orderId}, Current status: ${payment.order_status}`);

//         // Map Cashfree status
//         let mappedStatus;
//         switch (orderStatus) {
//             case "PAID":
//                 mappedStatus = "SUCCESS";
//                 break;
//             case "EXPIRED":
//             case "FAILED":
//                 mappedStatus = "FAILED";
//                 break;
//             case "CANCELLED":
//                 mappedStatus = "CANCELLED";
//                 break;
//             default:
//                 mappedStatus = "PENDING";
//         }

//         console.log(`🔄 Mapping status: ${orderStatus} -> ${mappedStatus}`);

//         // Update payment
//         payment.order_status = mappedStatus;
//         payment.payment_method = paymentMethod || null;
//         payment.transaction_id = transactionId || null;
//         payment.metadata = payment.metadata || {};
//         payment.metadata.webhook_data = body.data;
//         payment.metadata.last_webhook_received = new Date();

//         await payment.save();
//         console.log(`✅ Payment updated in database: ${orderId} -> ${mappedStatus}`);

//         // Update booking if payment successful
//         if (mappedStatus === "SUCCESS") {
//             await Booking.findByIdAndUpdate(payment.booking_id, {
//                 $set: {
//                     billStatus: "paid",
//                     status: "confirmed",
//                     paymentStatus: "completed",
//                     paymentDate: new Date(paymentTime || Date.now())
//                 },
//             });
//             console.log(`✅ Booking updated: ${payment.booking_id}`);
//         }

//         console.log(`🎉 Webhook processed successfully: orderId=${orderId}, status=${mappedStatus}`);
//         res.status(200).send("Webhook processed successfully");

//     } catch (error) {
//         console.error("❌ Webhook processing error:", error);
//         res.status(500).send("Server error");
//     }
// };

// // Get Payment Details
// const getPaymentDetails = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const payment = await Payment.findOne({
//             $or: [
//                 { _id: id },
//                 { orderId: id },
//                 { cf_order_id: id }
//             ]
//         })
//             .populate("booking_id", "bookingId totalBill status serviceDate vehicleDetails")
//             .populate("dealer_id", "name email phone")
//             .populate("user_id", "first_name last_name email phone");

//         if (!payment) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Payment not found"
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: "Payment details fetched successfully",
//             data: payment
//         });

//     } catch (error) {
//         console.error("Get Payment Details Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch payment details",
//             error: error.message
//         });
//     }
// };

// // Refund Payment
// const initiateRefund = async (req, res) => {
//     try {
//         const { order_id, refund_amount, refund_note } = req.body;

//         if (!order_id || !refund_amount) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Order ID and refund amount are required"
//             });
//         }

//         const payment = await Payment.findOne({ orderId: order_id });
//         if (!payment) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Payment not found"
//             });
//         }

//         if (payment.order_status !== "SUCCESS") {
//             return res.status(400).json({
//                 success: false,
//                 message: "Refund can only be initiated for successful payments"
//             });
//         }

//         if (refund_amount > payment.orderAmount) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Refund amount cannot exceed order amount"
//             });
//         }

//         // Implement Cashfree refund API call here
//         // const refundResponse = await axios.post(`${CASHFREE_BASE_URL}/orders/${order_id}/refunds`, {
//         //   refund_amount: refund_amount,
//         //   refund_note: refund_note || "Refund initiated"
//         // }, { headers: this.headers });

//         // For now, update payment record
//         payment.refund_amount = refund_amount;
//         payment.refund_status = "PENDING";
//         payment.metadata.refund_note = refund_note;
//         await payment.save();

//         res.status(200).json({
//             success: true,
//             message: "Refund initiated successfully",
//             data: {
//                 order_id: order_id,
//                 refund_amount: refund_amount,
//                 refund_status: "PENDING"
//             }
//         });

//     } catch (error) {
//         console.error("Refund Initiation Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to initiate refund",
//             error: error.message
//         });
//     }
// };

// // Get All Payments with Advanced Filtering and Analytics
// const getAllPayments = async (req, res) => {
//     try {
//         const {
//             page = 1,
//             limit = 10,
//             status,
//             payment_type,
//             payment_by,
//             payment_method,
//             dealer_id,
//             user_id,
//             booking_id,
//             startDate,
//             endDate,
//             minAmount,
//             maxAmount,
//             currency,
//             sortBy = 'createdAt',
//             sortOrder = 'desc',
//             search,
//             includeAnalytics = false
//         } = req.query;

//         // Build filter object
//         const filters = {};

//         // Status filter
//         if (status) {
//             const statusList = Array.isArray(status) ? status : status.split(',');
//             filters.order_status = { $in: statusList.map(s => s.trim().toUpperCase()) };
//         }

//         // Payment type filter
//         if (payment_type) {
//             filters.payment_type = { $in: payment_type.split(',').map(t => t.trim().toUpperCase()) };
//         }

//         // Payment by filter
//         if (payment_by) {
//             filters.payment_by = { $in: payment_by.split(',').map(p => p.trim().toLowerCase()) };
//         }

//         // Payment method filter
//         if (payment_method) {
//             filters.payment_method = { $in: payment_method.split(',').map(m => m.trim().toLowerCase()) };
//         }

//         // Entity filters
//         if (dealer_id) filters.dealer_id = dealer_id;
//         if (user_id) filters.user_id = user_id;
//         if (booking_id) filters.booking_id = booking_id;

//         // Currency filter
//         if (currency) {
//             filters.order_currency = currency.toUpperCase();
//         }

//         // Amount range filter
//         if (minAmount || maxAmount) {
//             filters.orderAmount = {};
//             if (minAmount) filters.orderAmount.$gte = parseFloat(minAmount);
//             if (maxAmount) filters.orderAmount.$lte = parseFloat(maxAmount);
//         }

//         // Date range filter
//         if (startDate || endDate) {
//             filters.createdAt = {};
//             if (startDate) {
//                 const start = new Date(startDate);
//                 start.setHours(0, 0, 0, 0);
//                 filters.createdAt.$gte = start;
//             }
//             if (endDate) {
//                 const end = new Date(endDate);
//                 end.setHours(23, 59, 59, 999);
//                 filters.createdAt.$lte = end;
//             }
//         }

//         // Search filter (searches in orderId, transaction_id, customer details via populate)
//         if (search) {
//             filters.$or = [
//                 { orderId: { $regex: search, $options: 'i' } },
//                 { transaction_id: { $regex: search, $options: 'i' } },
//                 { cf_order_id: isNaN(search) ? null : parseInt(search) }
//             ].filter(condition => Object.values(condition)[0] !== null);
//         }

//         // Sort configuration
//         const sortOptions = {};
//         const validSortFields = ['createdAt', 'updatedAt', 'orderAmount', 'order_status', 'orderId'];
//         const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
//         sortOptions[sortField] = sortOrder === 'asc' ? 1 : -1;

//         // Calculate pagination
//         const pageNum = parseInt(page);
//         const limitNum = parseInt(limit);
//         const skip = (pageNum - 1) * limitNum;

//         // Execute query with pagination
//         const payments = await Payment.find(filters)
//             .populate({
//                 path: "booking_id",
//                 select: "bookingId totalBill status serviceDate vehicleDetails serviceType",
//                 options: { strictPopulate: false },
//             })
//             .populate("dealer_id", "name email phone businessName")
//             .populate("user_id", "first_name last_name email phone")
//             .sort(sortOptions)
//             .skip(skip)
//             .limit(limitNum)
//             .lean();

//         // Get total count for pagination
//         const totalPayments = await Payment.countDocuments(filters);
//         const totalPages = Math.ceil(totalPayments / limitNum);

//         // Analytics data if requested
//         let analytics = null;
//         if (includeAnalytics === 'true') {
//             analytics = await getPaymentAnalytics(filters);
//         }

//         // Response structure
//         const response = {
//             success: true,
//             message: "Payments fetched successfully",
//             data: {
//                 payments,
//                 // pagination: {
//                 //     currentPage: pageNum,
//                 //     totalPages,
//                 //     totalPayments,
//                 //     hasNext: pageNum < totalPages,
//                 //     hasPrev: pageNum > 1,
//                 //     limit: limitNum
//                 // }
//             }
//         };

//         // Add analytics if requested
//         if (analytics) {
//             response.data.analytics = analytics;
//         }

//         res.status(200).json(response);

//     } catch (error) {
//         console.error("Get All Payments Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch payments",
//             error: error.message
//         });
//     }
// };

// // Payment Analytics Function
// const getPaymentAnalytics = async (filters = {}) => {
//     try {
//         // Total amounts by status
//         const amountByStatus = await Payment.aggregate([
//             { $match: filters },
//             {
//                 $group: {
//                     _id: "$order_status",
//                     totalAmount: { $sum: "$orderAmount" },
//                     count: { $sum: 1 }
//                 }
//             }
//         ]);

//         // Total successful amount
//         const successfulPayments = await Payment.aggregate([
//             { $match: { ...filters, order_status: "SUCCESS" } },
//             {
//                 $group: {
//                     _id: null,
//                     totalSuccessAmount: { $sum: "$orderAmount" },
//                     successCount: { $sum: 1 }
//                 }
//             }
//         ]);

//         // Daily revenue (last 30 days)
//         const thirtyDaysAgo = new Date();
//         thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

//         const dailyRevenue = await Payment.aggregate([
//             {
//                 $match: {
//                     ...filters,
//                     order_status: "SUCCESS",
//                     createdAt: { $gte: thirtyDaysAgo }
//                 }
//             },
//             {
//                 $group: {
//                     _id: {
//                         $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
//                     },
//                     dailyAmount: { $sum: "$orderAmount" },
//                     transactionCount: { $sum: 1 }
//                 }
//             },
//             { $sort: { _id: 1 } }
//         ]);

//         // Payment method distribution
//         const paymentMethodStats = await Payment.aggregate([
//             { $match: { ...filters, order_status: "SUCCESS" } },
//             {
//                 $group: {
//                     _id: "$payment_method",
//                     totalAmount: { $sum: "$orderAmount" },
//                     count: { $sum: 1 }
//                 }
//             }
//         ]);

//         // Monthly growth
//         const monthlyGrowth = await Payment.aggregate([
//             {
//                 $match: {
//                     ...filters,
//                     order_status: "SUCCESS"
//                 }
//             },
//             {
//                 $group: {
//                     _id: {
//                         year: { $year: "$createdAt" },
//                         month: { $month: "$createdAt" }
//                     },
//                     monthlyAmount: { $sum: "$orderAmount" },
//                     monthlyCount: { $sum: 1 }
//                 }
//             },
//             { $sort: { "_id.year": 1, "_id.month": 1 } }
//         ]);

//         return {
//             summary: {
//                 totalRevenue: successfulPayments[0]?.totalSuccessAmount || 0,
//                 totalTransactions: successfulPayments[0]?.successCount || 0,
//                 averageOrderValue: successfulPayments[0] ?
//                     successfulPayments[0].totalSuccessAmount / successfulPayments[0].successCount : 0
//             },
//             amountByStatus: amountByStatus.reduce((acc, curr) => {
//                 acc[curr._id] = {
//                     totalAmount: curr.totalAmount,
//                     count: curr.count
//                 };
//                 return acc;
//             }, {}),
//             dailyRevenue,
//             paymentMethodStats: paymentMethodStats.reduce((acc, curr) => {
//                 acc[curr._id || 'unknown'] = {
//                     totalAmount: curr.totalAmount,
//                     count: curr.count
//                 };
//                 return acc;
//             }, {}),
//             monthlyGrowth
//         };
//     } catch (error) {
//         console.error("Analytics Error:", error);
//         return null;
//     }
// };

// // Get Payment Statistics (Standalone API)
// const getPaymentStatistics = async (req, res) => {
//     try {
//         const { period = '30d', dealer_id, user_id } = req.query;

//         const filters = {};
//         if (dealer_id) filters.dealer_id = dealer_id;
//         if (user_id) filters.user_id = user_id;

//         // Calculate date range based on period
//         const startDate = new Date();
//         switch (period) {
//             case '7d':
//                 startDate.setDate(startDate.getDate() - 7);
//                 break;
//             case '30d':
//                 startDate.setDate(startDate.getDate() - 30);
//                 break;
//             case '90d':
//                 startDate.setDate(startDate.getDate() - 90);
//                 break;
//             case '1y':
//                 startDate.setFullYear(startDate.getFullYear() - 1);
//                 break;
//             default:
//                 startDate.setDate(startDate.getDate() - 30);
//         }
//         filters.createdAt = { $gte: startDate };

//         const analytics = await getPaymentAnalytics(filters);

//         if (!analytics) {
//             return res.status(500).json({
//                 success: false,
//                 message: "Failed to generate payment statistics"
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: "Payment statistics fetched successfully",
//             data: {
//                 period,
//                 ...analytics
//             }
//         });

//     } catch (error) {
//         console.error("Get Payment Statistics Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch payment statistics",
//             error: error.message
//         });
//     }
// };

// // Get Payments by Date Range (for reports)
// const getPaymentsByDateRange = async (req, res) => {
//     try {
//         const { startDate, endDate, export: exportFormat } = req.query;

//         if (!startDate || !endDate) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Start date and end date are required"
//             });
//         }

//         const start = new Date(startDate);
//         const end = new Date(endDate);
//         end.setHours(23, 59, 59, 999);

//         const filters = {
//             createdAt: { $gte: start, $lte: end }
//         };

//         const payments = await Payment.find(filters)
//             .populate({
//                 path: "booking_id",
//                 select: "bookingId serviceDate vehicleDetails serviceType",
//                 options: { strictPopulate: false },
//             })
//             .populate("dealer_id", "name businessName email phone")
//             .populate("user_id", "first_name last_name email phone")
//             .sort({ createdAt: -1 })
//             .lean();

//         // If export requested, format for CSV/Excel
//         if (exportFormat === 'csv') {
//             const csvData = formatPaymentsForExport(payments);
//             // In a real implementation, you would generate and send CSV file
//             // For now, return as JSON with CSV structure
//             return res.status(200).json({
//                 success: true,
//                 message: "Payments data for export",
//                 data: {
//                     payments: csvData,
//                     totalRecords: payments.length,
//                     dateRange: { startDate, endDate }
//                 }
//             });
//         }

//         const analytics = await getPaymentAnalytics(filters);

//         res.status(200).json({
//             success: true,
//             message: "Payments by date range fetched successfully",
//             data: {
//                 payments,
//                 totalRecords: payments.length,
//                 dateRange: { startDate, endDate },
//                 analytics: analytics.summary
//             }
//         });

//     } catch (error) {
//         console.error("Get Payments by Date Range Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch payments by date range",
//             error: error.message
//         });
//     }
// };

// // Helper function to format payments for export
// const formatPaymentsForExport = (payments) => {
//     return payments.map(payment => ({
//         'Order ID': payment.orderId,
//         'CF Order ID': payment.cf_order_id || 'N/A',
//         'Transaction ID': payment.transaction_id || 'N/A',
//         'Amount': payment.orderAmount,
//         'Currency': payment.order_currency,
//         'Status': payment.order_status,
//         'Payment Method': payment.payment_method || 'N/A',
//         'Payment Type': payment.payment_type,
//         'Paid By': payment.payment_by,
//         'Customer': payment.user_id ?
//             `${payment.user_id.first_name} ${payment.user_id.last_name}` : 'N/A',
//         'Dealer': payment.dealer_id?.name || 'N/A',
//         'Booking ID': payment.booking_id?.bookingId || 'N/A',
//         'Service Date': payment.booking_id?.serviceDate || 'N/A',
//         'Vehicle': payment.booking_id?.vehicleDetails?.model || 'N/A',
//         'Created Date': payment.createdAt,
//         'Updated Date': payment.updatedAt
//     }));
// };

// module.exports = {
//     getAllPayments,
//     getPaymentStatistics,
//     getPaymentsByDateRange,
//     createPaymentOrder,
//     verifyPayment,
//     paymentWebhook,
//     getPaymentDetails,
//     initiateRefund
// };
