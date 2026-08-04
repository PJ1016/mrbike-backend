const axios = require("axios")
const QRCode = require("qrcode")
const Payment = require("../models/Payment")
const Booking = require("../models/Booking")
const Customer = require("../models/customer_model")
const Dealer = require("../models/dealerModel")
const { generateBill } = require("./payment")
const { settleBookingWallet } = require("../helper/walletSettlement")
const { sendBookingNotification } = require("../helper/pushNotification")
const { cancelPendingPaymentSessions } = require("../helper/paymentSession")

const genDeliveryOtp = () => Math.floor(1000 + Math.random() * 9000)

const QR_DATA_URI_PREFIX = "data:image/png;base64,"

// Cashfree's session/payments APIs are inconsistent about whether
// payload.qrcode / default_qr_code is pure base64 or already a full data
// URI — normalize once here so we never double-prepend the prefix.
const normalizeQrCode = (value) => {
  if (!value) return { qrCodeDataUrl: null, qrCodeBase64: null }
  const base64 = value.startsWith(QR_DATA_URI_PREFIX) ? value.slice(QR_DATA_URI_PREFIX.length) : value
  return { qrCodeDataUrl: `${QR_DATA_URI_PREFIX}${base64}`, qrCodeBase64: base64 }
}

// Advance a booking to ready_for_delivery once its QR/UPI payment is confirmed
// SUCCESS — mirrors confirmCashReceived so both payment methods land in the
// same place: invoice generated, wallet settled, delivery OTP issued.
const advanceBookingAfterOnlinePayment = async (payment, io) => {
  const currentBooking = await Booking.findById(payment.booking_id)
  if (!currentBooking) return

  const alreadyAdvanced = ["ready_for_delivery", "delivered", "completed", "cash received"].includes(
    currentBooking.status,
  )
  if (alreadyAdvanced) return

  // Defense in depth: if the dealer has since switched this booking to CASH,
  // this payment belongs to an abandoned QR — do not let a late confirmation
  // silently override the dealer's cash flow (and double-settle the wallet).
  if (currentBooking.payment_method && currentBooking.payment_method !== "ONLINE") {
    console.warn(
      `[CASHFREE] Ignoring SUCCESS for payment ${payment._id} — booking ${currentBooking._id} was switched to ${currentBooking.payment_method}. Needs manual reconciliation.`,
    )
    return
  }

  const freshOtp = genDeliveryOtp()

  currentBooking.payment_method   = currentBooking.payment_method || "ONLINE"
  currentBooking.payment_status   = "completed"
  currentBooking.payment_verified = true
  currentBooking.deliveryOtp      = freshOtp
  currentBooking.status           = "ready_for_delivery"
  currentBooking.billStatus       = "paid"
  currentBooking.paymentStatus    = "completed"
  currentBooking.paymentDate      = new Date()
  await currentBooking.save()

  console.log(`[CASHFREE] Booking ${payment.booking_id} → ready_for_delivery | OTP: ${freshOtp}`)

  try {
    await generateBill({
      booking_id: payment.booking_id,
      payment_method: payment.payment_method || "ONLINE",
      transaction_id: payment.transaction_id || payment.cf_order_id || null,
      _id: payment._id,
    })
  } catch (billErr) {
    console.error("[CASHFREE] Bill generation failed:", billErr.message)
  }

  try {
    const settlement = await settleBookingWallet(currentBooking._id, "ONLINE")
    if (settlement) {
      console.log(`[CASHFREE] Wallet settled: ₹${settlement.txnAmount} credited (commission ${settlement.commissionRate}%)`)
    }
  } catch (settlErr) {
    console.error("[CASHFREE] Wallet settlement failed:", settlErr.message)
  }

  try {
    const user = await Customer.findById(currentBooking.user_id).select("device_token ftoken").lean()
    const userToken = user?.device_token || user?.ftoken
    if (userToken) {
      await sendBookingNotification({
        token: userToken,
        title: "Payment Received — Show OTP to Dealer",
        body: "Your payment has been confirmed. Show the OTP to the dealer to collect your bike.",
        data: {
          type: "otp_ready",
          bookingId: currentBooking._id.toString(),
          otp: String(freshOtp),
        },
        receiverId: currentBooking.user_id,
        receiverType: "user",
        bookingId: currentBooking._id,
      })
    }
  } catch (notifyErr) {
    console.error("[CASHFREE] User FCM error:", notifyErr.message)
  }

  if (io) {
    io.to(`user:${currentBooking.user_id}`).emit("booking:ready_for_delivery", {
      bookingId: currentBooking._id,
      status: "ready_for_delivery",
    })
  }
}

// Cashfree API Configuration
const getCashfreeBaseUrl = () => "https://api.cashfree.com/pg";

const getCashfreeHeaders = () => ({
  "x-client-id": process.env.CASHFREE_APP_ID,
  "x-client-secret": process.env.CASHFREE_SECRET_KEY,
  "x-api-version": "2023-08-01",
  "Content-Type": "application/json",
});

/**
 * Generate UPI QR Code for Payment
 * Called by Dealer App after booking is confirmed
 * Flow: Dealer generates QR -> User scans with any UPI app -> Payment completed
 */
const generateUPIQRCode = async (req, res) => {
  try {
    // `amount` is intentionally NOT read from req.body — the server is the
    // only authority on what a booking costs. See services/pricingEngine.js.
    const { booking_id, customer_email, customer_phone, customer_name } = req.body

    // Validation
    if (!booking_id) {
      return res.status(400).json({
        success: false,
        message: "booking_id is required",
      })
    }

    // Get booking details
    const booking = await Booking.findById(booking_id)
      .populate("user_id", "first_name last_name email phone")
      .populate("dealer_id", "name email")

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      })
    }

    // Entry-point guard — the dealer must have selected ONLINE via
    // /bookings/:bookingId/select-payment-method before a QR can be generated.
    if (booking.payment_method !== "ONLINE" || booking.status !== "payment_selected") {
      return res.status(400).json({
        success: false,
        message: "Select ONLINE payment method via /bookings/:bookingId/select-payment-method before generating a QR",
      })
    }

    // Server always charges Booking.customerTotal - Booking.discountAmount
    // (the `amountDue` virtual) — never a client-supplied amount.
    const amount = booking.amountDue
    if (!(amount >= 1)) {
      return res.status(400).json({
        success: false,
        message: "Booking has no amount due — pricing snapshot missing or already fully discounted",
      })
    }

    // Check if payment already exists and is successful
    const existingPayment = await Payment.findOne({
      booking_id: booking_id,
      order_status: "SUCCESS",
    })

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "Payment already completed for this booking",
      })
    }

    // Cancel any still-pending session from an earlier QR (e.g. dealer chose
    // ONLINE, switched to CASH, then switched back to ONLINE) so only the
    // fresh order below stays payable — never two live QR codes at once.
    await cancelPendingPaymentSessions(booking_id)

    // Generate unique order ID
    const orderId = `BIKEDOC_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Customer details from booking or request
    const customerDetails = {
      customer_id: booking.user_id?._id?.toString() || `CUST_${Date.now()}`,
      customer_email: customer_email || booking.user_id?.email || "customer@bikedoctor.com",
      customer_phone: customer_phone || booking.user_id?.phone || "9999999999",
      customer_name:
        customer_name ||
        `${booking.user_id?.first_name || ""} ${booking.user_id?.last_name || ""}`.trim() ||
        "Customer",
    }

    // Create Cashfree Order
    const orderPayload = {
      order_id: orderId,
      order_amount: Number.parseFloat(amount),
      order_currency: "INR",
      customer_details: customerDetails,
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || "https://bikedoctor.app"}/payment-status?order_id={order_id}`,
        notify_url: `${process.env.BACKEND_URL || "https://api.bikedoctor.app"}/bikedoctor/cashfree/webhook`,
        payment_methods: "upi",
      },
      order_expiry_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      order_note: `Payment for Booking ${booking.bookingId || booking_id}`,
      order_tags: {
        booking_id: booking_id,
        dealer_id: booking.dealer_id?._id?.toString(),
      },
    }

    console.log("Creating Cashfree order:", JSON.stringify(orderPayload, null, 2))

    // Step 1: Create order in Cashfree
    const orderResponse = await axios.post(`${getCashfreeBaseUrl()}/orders`, orderPayload, { headers: getCashfreeHeaders() })

    const orderData = orderResponse.data
    console.log("Cashfree order created:", JSON.stringify(orderData, null, 2))

    const paymentSessionId = orderData.payment_session_id

    // Step 2: Create UPI payment request to get QR code
    const upiPayload = {
      payment_session_id: paymentSessionId,
      payment_method: {
        upi: {
          channel: "qrcode",
        },
      },
    }

    let qrCodeDataUrl = null
    let qrCodeBase64 = null
    let upiLink = null

    try {
      // Try to get QR code from Cashfree sessions API
      const paymentResponse = await axios.post(`${getCashfreeBaseUrl()}/orders/sessions`, upiPayload, {
        headers: getCashfreeHeaders(),
      })

      const paymentData = paymentResponse.data
      console.log("UPI Sessions Response:", JSON.stringify(paymentData, null, 2))

      // Extract QR code or UPI link from response
      if (paymentData.data?.payload?.qrcode) {
        ;({ qrCodeDataUrl, qrCodeBase64 } = normalizeQrCode(paymentData.data.payload.qrcode))
      } else if (paymentData.data?.payload?.default_qr_code) {
        ;({ qrCodeDataUrl, qrCodeBase64 } = normalizeQrCode(paymentData.data.payload.default_qr_code))
      } else if (paymentData.data?.url) {
        upiLink = paymentData.data.url
      }
    } catch (sessionError) {
      console.log("Sessions API error, trying alternative method:", sessionError.response?.data || sessionError.message)
    }

    if (!qrCodeDataUrl) {
      // Fallback: Cashfree's hosted checkout page for this order/session —
      // no UPI VPA is ever hardcoded here; the customer completes payment on
      // Cashfree's own page, which is the only way a payment stays trackable
      // via the order-status/webhook flow below.
      const cashfreePaymentLink = `https://payments.cashfree.com/order/#${paymentSessionId}`

      upiLink = cashfreePaymentLink

      // Generate QR code from payment link
      const generatedDataUrl = await QRCode.toDataURL(cashfreePaymentLink, {
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
      })
      ;({ qrCodeDataUrl, qrCodeBase64 } = normalizeQrCode(generatedDataUrl))

      console.log("Generated QR from payment link:", cashfreePaymentLink)
    }

    // Save payment record
    const payment = new Payment({
      cf_order_id: orderData.cf_order_id,
      orderId: orderId,
      booking_id: booking_id,
      dealer_id: booking.dealer_id?._id,
      user_id: booking.user_id?._id,
      orderAmount: Number.parseFloat(amount),
      payment_type: "UPI_QR",
      order_currency: "INR",
      order_status: "PENDING",
      order_token: paymentSessionId || "pending",
      payment_by: "user",
      metadata: {
        qr_generated_at: new Date(),
        payment_session_id: paymentSessionId,
        cf_order_id: orderData.cf_order_id,
        expiry_time: orderPayload.order_expiry_time,
        upi_link: upiLink,
      },
    })

    await payment.save()
    console.log("Payment record saved:", payment._id)

    // Update booking with payment reference — pricing fields are never
    // touched here; they were fixed at booking creation (services/pricingEngine.js).
    await Booking.findByIdAndUpdate(booking_id, {
      $set: {
        billStatus: "pending",
      },
    })

    res.status(200).json({
      success: true,
      message: "UPI QR Code generated successfully",
      data: {
        order_id: orderId,
        cf_order_id: orderData.cf_order_id,
        payment_id: payment._id,
        amount: Number.parseFloat(amount),
        currency: "INR",
        qr_code: qrCodeDataUrl,
        qr_code_raw: qrCodeBase64,
        payment_session_id: paymentSessionId,
        payment_link: upiLink,
        expiry_time: orderPayload.order_expiry_time,
        status: "PENDING",
        booking_id: booking_id,
        customer: {
          name: customerDetails.customer_name,
          phone: customerDetails.customer_phone,
        },
      },
    })
  } catch (error) {
    console.error("Generate UPI QR Error:", error.response?.data || error.message)
    
    res.status(500).json({
      success: false,
      message: "Failed to generate UPI QR Code",
    })
  }
}

/**
 * Check Payment Status
 * Called by Dealer App to poll payment status after QR is shown
 */
const checkPaymentStatus = async (req, res) => {
  try {
    const { order_id } = req.params

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "order_id is required",
      })
    }

    // Get status from Cashfree
    const response = await axios.get(`${getCashfreeBaseUrl()}/orders/${order_id}`, { headers: getCashfreeHeaders() })

    const orderData = response.data

    // Update local payment record
    const payment = await Payment.findOne({ orderId: order_id })

    if (payment) {
      let mappedStatus = "PENDING"
      switch (orderData.order_status) {
        case "PAID":
          mappedStatus = "SUCCESS"
          break
        case "EXPIRED":
        case "FAILED":
          mappedStatus = "FAILED"
          break
        case "CANCELLED":
          mappedStatus = "CANCELLED"
          break
        default:
          mappedStatus = "PENDING"
      }

      // Update payment if status changed
      if (payment.order_status !== mappedStatus) {
        // This exact session was superseded by a later method switch / fresh
        // QR (see cancelPendingPaymentSessions) — a late PAID confirmation
        // must not resurrect it into advancing the booking.
        const wasSupersededByDealerSwitch = payment.order_status === "CANCELLED"

        payment.order_status = mappedStatus
        payment.metadata = {
          ...payment.metadata,
          last_status_check: new Date(),
          cashfree_status: orderData.order_status,
          ...(wasSupersededByDealerSwitch && mappedStatus === "SUCCESS"
            ? { orphaned_after_method_switch: true }
            : {}),
        }
        await payment.save()

        // Update booking if payment successful
        if (mappedStatus === "SUCCESS" && !wasSupersededByDealerSwitch) {
          await advanceBookingAfterOnlinePayment(payment, req.app.get("io"))
        } else if (mappedStatus === "SUCCESS" && wasSupersededByDealerSwitch) {
          console.warn(
            `[CASHFREE] Payment ${payment._id} for booking ${payment.booking_id} confirmed PAID after being superseded — flagged for manual reconciliation, booking not auto-advanced.`,
          )
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Payment status fetched successfully",
      data: {
        order_id: order_id,
        order_status: orderData.order_status,
        local_status: payment?.order_status || "UNKNOWN",
        amount: orderData.order_amount,
        payment_method: orderData.payment_method || null,
        transaction_id: orderData.cf_order_id,
        is_paid: orderData.order_status === "PAID",
      },
    })
  } catch (error) {
    console.error("Check Payment Status Error:", error.response?.data || error.message)
    res.status(500).json({
      success: false,
      message: "Failed to check payment status",
    })
  }
}

/**
 * Cashfree Webhook Handler
 * Called by Cashfree when payment status changes
 *
 * SECURITY: Route middleware verifies Cashfree's signature, timestamp and
 * idempotency key before this handler runs. Orders API verification remains
 * as defense in depth and as the authoritative payment-status check.
 */
const cashfreeWebhook = async (req, res) => {
  try {
    console.log("Cashfree webhook received")

    const eventType = req.body.type
    const data = req.body.data

    if (!data || !data.order) {
      console.log("Invalid webhook payload")
      return res.status(400).json({ success: false, message: "Invalid payload" })
    }

    const orderId = data.order.order_id

    // This is the industry-standard approach recommended by Cashfree for PG v3
    let verifiedOrderData
    try {
      const verifyResponse = await axios.get(`${getCashfreeBaseUrl()}/orders/${orderId}`, { headers: getCashfreeHeaders() })
      verifiedOrderData = verifyResponse.data
      console.log(`Verified order ${orderId} via API:`, verifiedOrderData.order_status)
    } catch (verifyError) {
      console.error(`Failed to verify order ${orderId}:`, verifyError.response?.data || verifyError.message)
      return res.status(401).json({
        success: false,
        message: "Payment verification failed",
      })
    }

    // Use verified status from API, not webhook payload (security)
    const orderStatus = verifiedOrderData.order_status
    const paymentMethodGroup = data.payment?.payment_group || "upi"
    const transactionId = data.payment?.cf_payment_id
    const utr = data.payment?.payment_group === "upi" ? data.payment?.bank_reference : null

    console.log(`Webhook: order_id=${orderId}, verified_status=${orderStatus}, event=${eventType}`)

    // Find and update payment
    const payment = await Payment.findOne({ orderId: orderId })

    if (!payment) {
      console.error(`Payment not found for order: ${orderId}`)
      return res.status(404).json({ success: false, message: "Payment not found" })
    }

    // Map status
    let mappedStatus = "PENDING"
    switch (orderStatus) {
      case "PAID":
        mappedStatus = "SUCCESS"
        break
      case "EXPIRED":
      case "FAILED":
        mappedStatus = "FAILED"
        break
      case "CANCELLED":
        mappedStatus = "CANCELLED"
        break
      case "ACTIVE":
      default:
        mappedStatus = "PENDING"
    }

    // This exact session was superseded by a later method switch / fresh QR
    // (see cancelPendingPaymentSessions) — a late webhook must not resurrect
    // it into advancing the booking or re-settling the wallet.
    const wasSupersededByDealerSwitch = payment.order_status === "CANCELLED"

    // Update payment record
    payment.order_status = mappedStatus
    payment.payment_method = paymentMethodGroup
    payment.transaction_id = transactionId || utr
    payment.metadata = {
      ...payment.metadata,
      webhook_received_at: new Date(),
      webhook_event: eventType,
      utr_number: utr,
      cf_payment_id: transactionId,
      payment_group: data.payment?.payment_group,
      verified_via: "orders_api",
      verified_at: new Date(),
      ...(wasSupersededByDealerSwitch && mappedStatus === "SUCCESS"
        ? { orphaned_after_method_switch: true }
        : {}),
    }

    await payment.save()
    console.log(`Payment updated: ${orderId} -> ${mappedStatus}`)

    // Update booking if payment successful
    if (mappedStatus === "SUCCESS" && !wasSupersededByDealerSwitch) {
      const io = req.app.get("io")
      await advanceBookingAfterOnlinePayment(payment, io)
      console.log(`Booking ${payment.booking_id} marked as paid`)

      // Emit socket event for real-time update
      if (io) {
        io.emit("payment:success", {
          order_id: orderId,
          booking_id: payment.booking_id,
          amount: payment.orderAmount,
          status: "SUCCESS",
        })
      }
    } else if (mappedStatus === "SUCCESS" && wasSupersededByDealerSwitch) {
      console.warn(
        `[CASHFREE] Webhook confirmed PAID for superseded order ${orderId} (booking ${payment.booking_id}) — flagged for manual reconciliation, booking not auto-advanced.`,
      )
    }

    res.status(200).json({ success: true, message: "Webhook processed" })
  } catch (error) {
    console.error("Webhook Error:", error)
    res.status(500).json({ success: false, message: "Webhook processing failed" })
  }
}

/**
 * Get Payment Details by Booking ID
 */
const getPaymentByBooking = async (req, res) => {
  try {
    const { booking_id } = req.params

    const payment = await Payment.findOne({ booking_id })
      .populate("booking_id")
      .populate("user_id", "first_name last_name email phone")
      .populate("dealer_id", "name email phone")
      .sort({ createdAt: -1 })

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "No payment found for this booking",
      })
    }

    res.status(200).json({
      success: true,
      message: "Payment details fetched successfully",
      data: payment,
    })
  } catch (error) {
    console.error("Get Payment Error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment details",
    })
  }
}

/**
 * Regenerate QR Code for existing pending payment
 */
const regenerateQRCode = async (req, res) => {
  try {
    const { payment_id } = req.params

    const payment = await Payment.findById(payment_id)

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      })
    }

    if (payment.order_status === "SUCCESS") {
      return res.status(400).json({
        success: false,
        message: "Payment already completed",
      })
    }

    // Get fresh payment session from Cashfree
    const response = await axios.get(`${getCashfreeBaseUrl()}/orders/${payment.orderId}`, { headers: getCashfreeHeaders() })

    const orderData = response.data

    // Check if order expired
    if (orderData.order_status === "EXPIRED") {
      // Create new order
      return res.status(400).json({
        success: false,
        message: "QR Code expired. Please generate a new payment.",
        expired: true,
      })
    }

    // Generate new QR from payment session
    const upiPayload = {
      payment_method: {
        upi: {
          channel: "qrcode",
        },
      },
    }

    const paymentResponse = await axios.post(`${getCashfreeBaseUrl()}/orders/${payment.orderId}/payments`, upiPayload, {
      headers: getCashfreeHeaders(),
    })

    const paymentData = paymentResponse.data

    let qrCodeDataUrl = null
    let qrCodeBase64 = null
    if (paymentData.data?.payload?.qrcode) {
      ;({ qrCodeDataUrl, qrCodeBase64 } = normalizeQrCode(paymentData.data.payload.qrcode))
    } else if (paymentData.data?.url) {
      const generatedDataUrl = await QRCode.toDataURL(paymentData.data.url, {
        width: 300,
        margin: 2,
      })
      ;({ qrCodeDataUrl, qrCodeBase64 } = normalizeQrCode(generatedDataUrl))
    }

    res.status(200).json({
      success: true,
      message: "QR Code regenerated successfully",
      data: {
        order_id: payment.orderId,
        qr_code: qrCodeDataUrl,
        qr_code_raw: qrCodeBase64,
        amount: payment.orderAmount,
        status: payment.order_status,
      },
    })
  } catch (error) {
    console.error("Regenerate QR Error:", error.response?.data || error.message)
    res.status(500).json({
      success: false,
      message: "Failed to regenerate QR Code",
    })
  }
}

/**
 * Cancel pending payment
 */
const cancelPayment = async (req, res) => {
  try {
    const { order_id } = req.params

    const payment = await Payment.findOne({ orderId: order_id })

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      })
    }

    if (payment.order_status === "SUCCESS") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel completed payment",
      })
    }

    // Update local status
    payment.order_status = "CANCELLED"
    payment.metadata = {
      ...payment.metadata,
      cancelled_at: new Date(),
    }
    await payment.save()

    // Update booking
    await Booking.findByIdAndUpdate(payment.booking_id, {
      $set: {
        billStatus: "cancelled",
      },
    })

    res.status(200).json({
      success: true,
      message: "Payment cancelled successfully",
      data: {
        order_id: order_id,
        status: "CANCELLED",
      },
    })
  } catch (error) {
    console.error("Cancel Payment Error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to cancel payment",
    })
  }
}

/**
 * Get all UPI QR payments with filters
 */
const getAllQRPayments = async (req, res) => {
  try {
    const { status, dealer_id, page = 1, limit = 20, startDate, endDate } = req.query

    const filters = { payment_type: "UPI_QR" }

    if (status) filters.order_status = status.toUpperCase()
    if (dealer_id) filters.dealer_id = dealer_id

    if (startDate || endDate) {
      filters.createdAt = {}
      if (startDate) filters.createdAt.$gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        filters.createdAt.$lte = end
      }
    }

    const payments = await Payment.find(filters)
      .populate("booking_id", "bookingId status serviceDate")
      .populate("user_id", "first_name last_name phone")
      .populate("dealer_id", "name")
      .sort({ createdAt: -1 })
      .limit(Number.parseInt(limit))
      .skip((Number.parseInt(page) - 1) * Number.parseInt(limit))

    const total = await Payment.countDocuments(filters)

    res.status(200).json({
      success: true,
      message: "QR Payments fetched successfully",
      data: {
        payments,
        pagination: {
          currentPage: Number.parseInt(page),
          totalPages: Math.ceil(total / Number.parseInt(limit)),
          totalRecords: total,
        },
      },
    })
  } catch (error) {
    console.error("Get All QR Payments Error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    })
  }
}

module.exports = {
  generateUPIQRCode,
  checkPaymentStatus,
  cashfreeWebhook,
  getPaymentByBooking,
  regenerateQRCode,
  cancelPayment,
  getAllQRPayments,
}
