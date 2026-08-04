const crypto = require("crypto");
const CashfreeWebhookEvent = require("../models/CashfreeWebhookEvent");

const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;
const PROCESSING_LEASE_MS = 10 * 60 * 1000;
const COMPLETED_RETENTION_MS = 24 * 60 * 60 * 1000;

function secureFailureLog(req, reason) {
  console.warn("[CASHFREE_WEBHOOK] Verification rejected", {
    reason,
    path: req.originalUrl,
  });
}

function signaturesMatch(expected, received) {
  const expectedBuffer = Buffer.from(expected, "base64");
  const receivedBuffer = Buffer.from(received, "base64");
  return (
    expectedBuffer.length > 0 &&
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function verifiedEventId(req) {
  const headerId = req.get("x-idempotency-key") || req.get("x-idempotency-header");
  if (headerId) {
    return `cashfree:${crypto.createHash("sha256").update(headerId).digest("hex")}`;
  }

  const orderId = req.body?.data?.order?.order_id || "unknown-order";
  const paymentId = req.body?.data?.payment?.cf_payment_id || "unknown-payment";
  const eventType = req.body?.type || "unknown-event";
  const paymentStatus = req.body?.data?.payment?.payment_status || "unknown-status";
  return `cashfree:legacy:${crypto
    .createHash("sha256")
    .update(`${eventType}:${orderId}:${paymentId}:${paymentStatus}`)
    .digest("hex")}`;
}

async function cashfreeWebhookSecurity(req, res, next) {
  const signature = req.get("x-webhook-signature");
  const timestampHeader = req.get("x-webhook-timestamp");
  const secret = process.env.CASHFREE_SECRET_KEY;

  if (!signature || !timestampHeader || !req.rawBody || !secret) {
    secureFailureLog(req, "missing_required_verification_data");
    return res.status(401).json({ success: false, message: "Webhook verification failed" });
  }

  const timestamp = Number(timestampHeader);
  const now = Date.now();
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    secureFailureLog(req, "invalid_timestamp");
    return res.status(401).json({ success: false, message: "Webhook verification failed" });
  }

  const age = now - timestamp;
  if (age < -MAX_WEBHOOK_AGE_MS || age > MAX_WEBHOOK_AGE_MS) {
    secureFailureLog(req, "stale_or_future_timestamp");
    return res.status(401).json({ success: false, message: "Webhook verification failed" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(timestampHeader)
    .update(req.rawBody)
    .digest("base64");

  if (!signaturesMatch(expectedSignature, signature)) {
    secureFailureLog(req, "invalid_signature");
    return res.status(401).json({ success: false, message: "Webhook verification failed" });
  }

  // Payload fields are read only after authenticity and freshness are proven.
  const eventId = verifiedEventId(req);
  const event = new CashfreeWebhookEvent({
    eventId,
    eventType: req.body?.type || null,
    orderId: req.body?.data?.order?.order_id || null,
    paymentId: req.body?.data?.payment?.cf_payment_id?.toString() || null,
    webhookTimestamp: new Date(timestamp),
    expiresAt: new Date(now + PROCESSING_LEASE_MS),
  });

  try {
    await event.save();
  } catch (error) {
    if (error?.code === 11000) {
      const existingEvent = await CashfreeWebhookEvent.findOne({ eventId }).select("status").lean();
      if (existingEvent?.status === "COMPLETED") {
        return res.status(200).json({ success: true, message: "Webhook already processed" });
      }
      // The first delivery is still executing (or its worker terminated).
      // Ask Cashfree to retry; the processing lease will eventually expire.
      return res.status(503).json({ success: false, message: "Webhook processing in progress" });
    }
    console.error("[CASHFREE_WEBHOOK] Unable to reserve webhook event", { message: error.message });
    return res.status(503).json({ success: false, message: "Webhook processing unavailable" });
  }

  let finalized = false;
  const finalize = async (completed) => {
    if (finalized) return;
    finalized = true;
    try {
      if (completed && res.statusCode >= 200 && res.statusCode < 500) {
        await CashfreeWebhookEvent.updateOne(
          { _id: event._id },
          {
            $set: {
              status: "COMPLETED",
              completedAt: new Date(),
              expiresAt: new Date(Date.now() + COMPLETED_RETENTION_MS),
            },
          },
        );
      } else {
        // Allow Cashfree's next delivery to retry after an internal failure.
        await CashfreeWebhookEvent.deleteOne({ _id: event._id, status: "PROCESSING" });
      }
    } catch (error) {
      console.error("[CASHFREE_WEBHOOK] Unable to finalize webhook event", { message: error.message });
    }
  };

  res.once("finish", () => finalize(true));
  res.once("close", () => {
    if (!res.writableFinished) finalize(false);
  });
  req.cashfreeWebhookEventId = eventId;
  return next();
}

module.exports = cashfreeWebhookSecurity;
