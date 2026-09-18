const axios = require("axios")
const QRCode = require("qrcode")
const Payment = require("../models/Payment")
const Booking = require("../models/Booking")
const Customer = require("../models/customer_model")
const Dealer = require("../models/dealerModel")
const { generateBill } = require("./payment")
const { settleBookingWallet } = require("../helper/walletSettlement")
const { sendBookingNotification } = require("../helper/pushNotification")
const {
  acquirePaymentOrderLock,
  releasePaymentOrderLock,
  cancelPendingPaymentSessions,
  terminateCashfreeOrder,
} = require("../helper/paymentSession")
const {
  enqueuePaymentReconciliation,
  completeReconciliationTask,
} = require("../services/paymentReconciliationService")

const genDeliveryOtp = () => Math.floor(1000 + Math.random() * 9000)

const QR_DATA_URI_PREFIX = "data:image/png;base64,"
const CASHFREE_RESOURCE_PAYMENT_LINK = "PAYMENT_LINK"

// Cashfree's session/payments APIs are inconsistent about whether
// payload.qrcode / default_qr_code is pure base64 or already a full data
// URI — normalize once here so we never double-prepend the prefix.
const normalizeQrCode = (value) => {
  if (!value) return { qrCodeDataUrl: null, qrCodeBase64: null }
  const base64 = value.startsWith(QR_DATA_URI_PREFIX) ? value.slice(QR_DATA_URI_PREFIX.length) : value
  return { qrCodeDataUrl: `${QR_DATA_URI_PREFIX}${base64}`, qrCodeBase64: base64 }
}

const isPaymentLink = (payment) =>
  payment?.metadata?.cashfree_resource === CASHFREE_RESOURCE_PAYMENT_LINK

const mapCashfreeStatus = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "PAID":
    case "SUCCESS":
      return "SUCCESS"
    case "EXPIRED":
      return "EXPIRED"
    case "FAILED":
      return "FAILED"
    case "CANCELLED":
    case "TERMINATED":
    case "TERMINATION_REQUESTED":
      return "CANCELLED"
    default:
      return "PENDING"
  }
}

// Advance a booking to ready_for_delivery once its QR/UPI payment is confirmed
// SUCCESS — mirrors confirmCashReceived so both payment methods land in the
// same place: invoice generated, wallet settled, delivery OTP issued.
//
// The atomic update is deliberately the first state-changing operation. A
// status poll and a webhook can arrive together; only the caller that claims
// payment_verified:false may issue an OTP, invoice, or wallet settlement.
const advanceBookingAfterOnlinePayment = async (payment, io) => {
  const freshOtp = genDeliveryOtp()
  const currentBooking = await Booking.findOneAndUpdate(
    {
      _id: payment.booking_id,
      status: "payment_selected",
      payment_verified: { $ne: true },
      $or: [{ payment_method: "ONLINE" }, { payment_method: null }, { payment_method: { $exists: false } }],
    },
    {
      $set: {
        payment_method: "ONLINE",
        payment_status: "completed",
        payment_verified: true,
        deliveryOtp: freshOtp,
        status: "ready_for_delivery",
        billStatus: "paid",
        paymentStatus: "completed",
        paymentDate: new Date(),
      },
    },
    { new: true },
  )

  if (!currentBooking) {
    console.log(`[CASHFREE] Booking ${payment.booking_id} was already finalized or its payment method changed; skipping duplicate confirmation.`)
    return false
  }

  await enqueuePaymentReconciliation(payment)
  await completeReconciliationTask(payment, "BOOKING_SYNC")

  console.log(`[CASHFREE] Booking ${payment.booking_id} → ready_for_delivery | OTP: ${freshOtp}`)

  try {
    await generateBill({
      booking_id: payment.booking_id,
      payment_method: payment.payment_method || "ONLINE",
      transaction_id: payment.transaction_id || payment.cf_order_id || null,
      _id: payment._id,
    })
    await completeReconciliationTask(payment, "INVOICE")
  } catch (billErr) {
    console.error("[CASHFREE] Bill generation failed:", billErr.message)
  }

  try {
    const settlement = await settleBookingWallet(currentBooking._id, "ONLINE")
    if (settlement) {
      console.log(`[CASHFREE] Wallet settled: ₹${settlement.txnAmount} credited (commission ${settlement.commissionRate}%)`)
    }
    await completeReconciliationTask(payment, "WALLET")
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
    await completeReconciliationTask(payment, "NOTIFICATION")
  } catch (notifyErr) {
    console.error("[CASHFREE] User FCM error:", notifyErr.message)
  }

  if (io) {
    io.to(`user:${currentBooking.user_id}`).emit("booking:ready_for_delivery", {
      bookingId: currentBooking._id,
      status: "ready_for_delivery",
    })
  }
  return true
}

// Cashfree API Configuration
const getCashfreeBaseUrl = () => "https://api.cashfree.com/pg";

const getCashfreeHeaders = () => ({
  "x-client-id": process.env.CASHFREE_APP_ID,
  "x-client-secret": process.env.CASHFREE_SECRET_KEY,
  "x-api-version": "2023-08-01",
  "Content-Type": "application/json",
});

const getVerifiedPaymentDetails = async (orderId, fallback = {}) => {
  try {
    const response = await axios.get(
      `${getCashfreeBaseUrl()}/orders/${encodeURIComponent(orderId)}/payments`,
      { headers: getCashfreeHeaders() },
    )
    const payments = Array.isArray(response.data) ? response.data : response.data?.data || []
    return payments.find((item) => item.payment_status === "SUCCESS") || payments[0] || fallback
  } catch (error) {
    console.error("[CASHFREE] Unable to fetch verified payment details", {
      orderId,
      message: error.response?.data?.message || error.message,
    })
    return fallback
  }
}

const getCashfreePaymentLink = async (linkId) => {
  const response = await axios.get(
    // Cashfree links create one or more underlying PG orders. The documented
    // orders endpoint is the authoritative way to verify a link payment; a
    // link can stay ACTIVE after failed attempts, so link state alone is not
    // enough to mark a booking paid.
    `${getCashfreeBaseUrl()}/links/${encodeURIComponent(linkId)}/orders`,
    { headers: getCashfreeHeaders() },
  )
  const orders = Array.isArray(response.data) ? response.data : response.data?.data || []
  const successfulOrder = orders.find((item) => item?.order_status === "PAID")
  const latestOrder = successfulOrder || orders[0] || null
  return {
    link_status: successfulOrder ? "PAID" : "ACTIVE",
    order_amount: latestOrder?.order_amount,
    cf_order_id: latestOrder?.cf_order_id,
    cf_payment_id: latestOrder?.cf_payment_id,
    payment_group: latestOrder?.payment_group,
    bank_reference: latestOrder?.bank_reference,
  }
}

/**
 * Generate UPI QR Code for Payment
 * Called by Dealer App after booking is confirmed
 * Flow: Dealer generates QR -> User scans with any UPI app -> Payment completed
 */
const generateUPIQRCode = async (req, res) => {
  let paymentOrderLockToken = null
  let lockedBookingId = null
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

    lockedBookingId = booking_id
    paymentOrderLockToken = await acquirePaymentOrderLock(booking_id)

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

    // Cashfree Payment Links are the supported scan-from-another-phone flow.
    // Store the Cashfree link_id in orderId so the existing authenticated
    // status route and Payment ownership middleware continue to work.
    const linkId = `BIKEDOC_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const expiryTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()

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

    const linkPayload = {
      link_id: linkId,
      link_amount: Number.parseFloat(amount),
      link_currency: "INR",
      customer_details: {
        customer_email: customerDetails.customer_email,
        customer_phone: customerDetails.customer_phone,
        customer_name: customerDetails.customer_name,
      },
      link_partial_payments: false,
      link_auto_reminders: false,
      link_notify: { send_sms: false, send_email: false },
      link_meta: {
        return_url: `${process.env.FRONTEND_URL || "https://bikedoctor.app"}/payment-status?link_id={link_id}`,
        notify_url: `${process.env.BACKEND_URL || "https://api.bikedoctor.app"}/bikedoctor/cashfree/webhook`,
      },
      link_expiry_time: expiryTime,
      link_purpose: `Payment for Booking ${booking.bookingId || booking_id}`,
      link_notes: {
        booking_id: booking_id.toString(),
        dealer_id: booking.dealer_id?._id?.toString() || "",
      },
    }

    console.log("Creating Cashfree booking payment link:", JSON.stringify({ ...linkPayload, customer_details: { ...customerDetails, customer_phone: "***" } }))
    const linkResponse = await axios.post(`${getCashfreeBaseUrl()}/links`, linkPayload, {
      headers: getCashfreeHeaders(),
    })
    const linkData = linkResponse.data || {}
    const linkUrl = typeof linkData.link_url === "string" ? linkData.link_url.trim() : ""
    if (!linkUrl) {
      const linkError = new Error("Cashfree did not return a payment link URL")
      linkError.code = "CASHFREE_LINK_URL_MISSING"
      throw linkError
    }

    // The QR always encodes Cashfree's returned link_url. Never construct a
    // payments.cashfree.com URL from a payment_session_id.
    const generatedDataUrl = await QRCode.toDataURL(linkUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    })
    const { qrCodeDataUrl, qrCodeBase64 } = normalizeQrCode(generatedDataUrl)

    // Save payment record
    const payment = new Payment({
      orderId: linkId,
      booking_id: booking_id,
      dealer_id: booking.dealer_id?._id,
      user_id: booking.user_id?._id,
      orderAmount: Number.parseFloat(amount),
      payment_type: "UPI_QR",
      order_currency: "INR",
      order_status: "PENDING",
      order_token: linkId,
      payment_by: "user",
      metadata: {
        qr_generated_at: new Date(),
        cashfree_resource: CASHFREE_RESOURCE_PAYMENT_LINK,
        cashfree_link_id: linkData.cf_link_id || null,
        link_id: linkData.link_id || linkId,
        link_url: linkUrl,
        expiry_time: linkData.link_expiry_time || expiryTime,
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
        order_id: linkId,
        cf_link_id: linkData.cf_link_id || null,
        payment_id: payment._id,
        amount: Number.parseFloat(amount),
        currency: "INR",
        qr_code: qrCodeDataUrl,
        qr_code_raw: qrCodeBase64,
        payment_link: linkUrl,
        expiry_time: linkData.link_expiry_time || expiryTime,
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

    if (error.code === "PAYMENT_ORDER_LOCKED" || error.code === "CASHFREE_ORDER_ALREADY_PAID") {
      return res.status(409).json({
        success: false,
        message: error.message,
      })
    }
    res.status(500).json({
      success: false,
      message: "Failed to generate UPI QR Code",
    })
  } finally {
    if (paymentOrderLockToken && lockedBookingId) {
      await releasePaymentOrderLock(lockedBookingId, paymentOrderLockToken).catch((lockError) => {
        console.error("[CASHFREE] Failed to release payment order lock", { message: lockError.message })
      })
    }
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

    const payment = await Payment.findOne({ orderId: order_id })
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" })
    }

    const paymentLink = isPaymentLink(payment)
    // Payment links are verified from the Links API; legacy QR orders retain
    // their existing Orders API status path for backward compatibility.
    const remoteData = paymentLink
      ? await getCashfreePaymentLink(order_id)
      : (await axios.get(`${getCashfreeBaseUrl()}/orders/${encodeURIComponent(order_id)}`, { headers: getCashfreeHeaders() })).data
    let remoteStatus = paymentLink ? remoteData.link_status : remoteData.order_status
    if (paymentLink && remoteStatus === "ACTIVE" && new Date(payment.metadata?.expiry_time || 0).getTime() <= Date.now()) {
      remoteStatus = "EXPIRED"
    }
    const mappedStatus = mapCashfreeStatus(remoteStatus)

    if (payment) {
      const verifiedPayment = !paymentLink && remoteStatus === "PAID"
        ? await getVerifiedPaymentDetails(order_id)
        : null

      // Update payment if status changed
      if (payment.order_status !== mappedStatus) {
        // This exact session was superseded by a later method switch / fresh
        // QR (see cancelPendingPaymentSessions) — a late PAID confirmation
        // must not resurrect it into advancing the booking.
        const wasSupersededByDealerSwitch = payment.order_status === "CANCELLED"

        payment.order_status = mappedStatus
        payment.cf_payment_id = verifiedPayment?.cf_payment_id?.toString() || payment.cf_payment_id
        payment.transaction_id = verifiedPayment?.cf_payment_id?.toString() || payment.transaction_id || remoteData.cf_link_id?.toString()
        payment.utr_number = verifiedPayment?.bank_reference || payment.utr_number
        payment.payment_method = verifiedPayment?.payment_group || payment.payment_method || (paymentLink ? "upi" : null)
        payment.gateway_status = verifiedPayment?.payment_status || remoteStatus
        payment.verified_amount = Number(paymentLink ? remoteData.order_amount ?? payment.orderAmount : remoteData.order_amount)
        payment.verified_timestamp = new Date()
        payment.metadata = {
          ...payment.metadata,
          last_status_check: new Date(),
          cashfree_status: remoteStatus,
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
        order_status: remoteStatus,
        local_status: payment.order_status,
        amount: paymentLink ? remoteData.order_amount ?? payment.orderAmount : remoteData.order_amount,
        payment_method: payment.payment_method || null,
        transaction_id: paymentLink ? remoteData.cf_link_id || null : remoteData.cf_order_id,
        is_paid: mappedStatus === "SUCCESS",
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
    const linkId = data?.link?.link_id || data?.payment_link?.link_id || null
    const orderId = data?.order?.order_id || null
    const resourceId = linkId || orderId

    if (!data || !resourceId) {
      console.log("Invalid webhook payload")
      return res.status(400).json({ success: false, message: "Invalid payload" })
    }

    const payment = await Payment.findOne({ orderId: resourceId })
    if (!payment) {
      console.error(`Payment not found for Cashfree resource: ${resourceId}`)
      return res.status(404).json({ success: false, message: "Payment not found" })
    }

    // Do not trust webhook status fields. Verify the corresponding resource
    // with Cashfree before writing local payment or booking state.
    const paymentLink = isPaymentLink(payment)
    let verifiedData
    try {
      verifiedData = paymentLink
        ? await getCashfreePaymentLink(resourceId)
        : (await axios.get(`${getCashfreeBaseUrl()}/orders/${encodeURIComponent(resourceId)}`, { headers: getCashfreeHeaders() })).data
      console.log(`Verified Cashfree ${paymentLink ? "link" : "order"} ${resourceId}:`, paymentLink ? verifiedData.link_status : verifiedData.order_status)
    } catch (verifyError) {
      console.error(`Failed to verify Cashfree ${paymentLink ? "link" : "order"} ${resourceId}:`, verifyError.response?.data || verifyError.message)
      return res.status(401).json({
        success: false,
        message: "Payment verification failed",
      })
    }

    // Use verified status from API, not webhook payload (security)
    const remoteStatus = paymentLink ? verifiedData.link_status : verifiedData.order_status
    const verifiedPayment = paymentLink ? {} : await getVerifiedPaymentDetails(resourceId, data.payment || {})
    const paymentMethodGroup = verifiedPayment.payment_group || payment.payment_method || (paymentLink ? "upi" : null)
    const transactionId = verifiedPayment.cf_payment_id
    const utr = verifiedPayment.payment_group === "upi" ? verifiedPayment.bank_reference : null
    const mappedStatus = mapCashfreeStatus(remoteStatus)

    console.log(`Webhook: resource_id=${resourceId}, verified_status=${remoteStatus}, event=${eventType}`)

    // This exact session was superseded by a later method switch / fresh QR
    // (see cancelPendingPaymentSessions) — a late webhook must not resurrect
    // it into advancing the booking or re-settling the wallet.
    const wasSupersededByDealerSwitch = payment.order_status === "CANCELLED"

    // A delayed non-success event must never downgrade a confirmed payment.
    if (payment.order_status !== "SUCCESS" || mappedStatus === "SUCCESS") {
      payment.order_status = mappedStatus
    }
    payment.payment_method = paymentMethodGroup
    payment.cf_payment_id = transactionId?.toString() || payment.cf_payment_id
    payment.transaction_id = transactionId || utr || payment.transaction_id || verifiedData.cf_link_id?.toString()
    payment.utr_number = utr
    payment.gateway_status = verifiedPayment.payment_status || remoteStatus
    payment.verified_amount = Number(paymentLink ? verifiedData.order_amount ?? payment.orderAmount : verifiedData.order_amount)
    payment.verified_timestamp = new Date()
    payment.metadata = {
      ...payment.metadata,
      webhook_received_at: new Date(),
      webhook_event: eventType,
      utr_number: utr,
      cf_payment_id: transactionId,
      payment_group: data.payment?.payment_group,
      verified_via: paymentLink ? "links_api" : "orders_api",
      verified_at: new Date(),
      ...(wasSupersededByDealerSwitch && mappedStatus === "SUCCESS"
        ? { orphaned_after_method_switch: true }
        : {}),
    }

    await payment.save()
    console.log(`Payment updated: ${resourceId} -> ${mappedStatus}`)

    // Update booking if payment successful
    if (mappedStatus === "SUCCESS" && !wasSupersededByDealerSwitch) {
      const io = req.app.get("io")
      await advanceBookingAfterOnlinePayment(payment, io)
      console.log(`Booking ${payment.booking_id} marked as paid`)

      // Emit socket event for real-time update
      if (io) {
        io.emit("payment:success", {
          order_id: resourceId,
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

    if (isPaymentLink(payment)) {
      const linkData = await getCashfreePaymentLink(payment.orderId)
      const linkStatus =
        linkData.link_status === "ACTIVE" && new Date(payment.metadata?.expiry_time || 0).getTime() <= Date.now()
          ? "EXPIRED"
          : linkData.link_status
      const mappedStatus = mapCashfreeStatus(linkStatus)
      if (mappedStatus !== "PENDING") {
        payment.order_status = mappedStatus
        payment.gateway_status = linkData.link_status
        await payment.save()
        return res.status(400).json({
          success: false,
          message: mappedStatus === "EXPIRED" ? "QR Code expired. Please generate a new payment." : "Payment link is no longer active.",
          expired: mappedStatus === "EXPIRED",
        })
      }

      const linkUrl = payment.metadata?.link_url
      if (typeof linkUrl !== "string" || !linkUrl) {
        return res.status(500).json({ success: false, message: "Payment link URL is unavailable. Please generate a new payment." })
      }
      const generatedDataUrl = await QRCode.toDataURL(linkUrl, { width: 400, margin: 2, errorCorrectionLevel: "M" })
      const { qrCodeDataUrl, qrCodeBase64 } = normalizeQrCode(generatedDataUrl)
      return res.status(200).json({
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

    await terminateCashfreeOrder(payment)

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
