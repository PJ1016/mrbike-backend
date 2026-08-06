const Booking = require("../models/Booking");
const Bill = require("../models/billSchema");
const Dealer = require("../models/dealerModel");
const InvoiceCounter = require("../models/invoiceCounterModel");
const { PRICING_WRITE_BYPASS_FLAG, round2 } = require("./pricingEngine");

// Sequential, atomic, per-year invoice numbers (e.g. INV-2026-000001).
// findOneAndUpdate($inc, upsert) is a single atomic Mongo op, so concurrent
// invoice creations (payment webhook + cash-confirm racing) can never
// collide or skip a number. Only ever called for a brand-new invoice —
// existing bills keep whatever bill_number they were created with.
async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const key = `invoice_${year}`;
    const counter = await InvoiceCounter.findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
    );
    return `INV-${year}-${String(counter.seq).padStart(6, "0")}`;
}

function resolveDealerDetails(dealer) {
    if (!dealer) {
        return { name: null, address: null, phone: null, gst_number: null, logo_url: null };
    }
    const address =
        dealer.fullAddress ||
        [dealer.presentAddress?.address, dealer.presentAddress?.city, dealer.presentAddress?.state]
            .filter(Boolean)
            .join(", ") ||
        [dealer.permanentAddress?.address, dealer.permanentAddress?.city, dealer.permanentAddress?.state]
            .filter(Boolean)
            .join(", ") ||
        null;

    return {
        name: dealer.shopName || null,
        address: address || null,
        phone: dealer.shopContact || dealer.phone || null,
        gst_number: dealer.gstNumber || null,
        logo_url: dealer.shopImages?.[0] || null,
    };
}

// Core invoice creation — this is the exact logic that used to live in
// controller/payment.js#generateBill, kept byte-for-byte so every existing
// trigger (payment webhook, cashfree QR, cash-received/cash-confirm) keeps
// working unchanged. This function does NOT gate on booking eligibility —
// callers are trusted to invoke it only once payment is actually complete.
// The one exception (booking-completed fallback) does its own gating before
// calling this; see controller/booking.js.
async function getOrCreateInvoice(bookingId, paymentMeta = {}) {
    const existingBill = await Bill.findOne({ booking_id: bookingId });
    if (existingBill) {
        console.log(`📄 Invoice already exists for booking: ${bookingId}`);
        return existingBill;
    }

    const booking = await Booking.findById(bookingId)
        .populate("user_id", "first_name last_name email phone")
        .populate({
            path: "userBike_id",
            select: "model registration_number vin bike_cc variant_id",
            populate: {
                path: "variant_id",
                model: "BikeVariant",
                select: "variant_name engine_cc model_id",
                populate: {
                    path: "model_id",
                    model: "BikeModel",
                    select: "model_name company_id",
                    populate: { path: "company_id", model: "BikeCompany", select: "name" },
                },
            },
        })
        .populate(
            "dealer_id",
            "shopName fullAddress presentAddress permanentAddress shopContact phone gstNumber shopImages tax commission pickupCharges dropCharges providesPickup providesDrop"
        )
        .populate({
            path: "services",
            model: "AdminService",
            select: "bikes",
            populate: { path: "base_service_id", select: "name" },
        })
        .populate({
            path: "additionalServices",
            select: "bikes",
            populate: { path: "base_additional_service_id", select: "name" },
        });

    if (!booking) {
        throw new Error("Booking not found for invoice generation");
    }

    const bikeCC = parseInt(booking.userBike_id?.bike_cc || 0);
    const resolvePrice = (doc) => {
        if (!doc || !Array.isArray(doc.bikes)) return 0;
        const match = doc.bikes.find((b) => b.cc === bikeCC);
        return match ? match.price : 0;
    };

    const services = [];
    let subtotal = 0;

    if (booking.services && booking.services.length > 0) {
        booking.services.forEach((svc) => {
            const name = svc.base_service_id?.name || "Service";
            const price = resolvePrice(svc);
            services.push({ name, price, quantity: 1, total: price });
            subtotal += price;
        });
    }

    if (booking.additionalServices && booking.additionalServices.length > 0) {
        booking.additionalServices.forEach((svc) => {
            const name = svc.base_additional_service_id?.name || "Additional Service";
            const price = resolvePrice(svc);
            services.push({ name: `Additional: ${name}`, price, quantity: 1, total: price });
            subtotal += price;
        });
    }

    if (services.length === 0 && booking.serviceSummary && booking.serviceSummary.length > 0) {
        booking.serviceSummary.forEach((service) => {
            if (service.serviceName) {
                services.push({
                    name: service.serviceName,
                    price: service.price || 0,
                    quantity: 1,
                    total: service.price || 0,
                });
                subtotal += service.price || 0;
            }
        });
    }

    // Pricing is the frozen snapshot taken by pricingEngine at booking
    // creation — never recomputed from the dealer's current settings.
    // Detection is `pricingVersion` presence only (see controller/payment.js
    // history) so a legitimately-zero tax/charge never falls through to the
    // legacy recompute branch below.
    const hasPricingSnapshot = Boolean(booking.pricingVersion);

    let pickupCharge, dropCharge, taxRate, taxAmount, totalAmount, commissionRate, commissionAmount, dealerEarnings;
    // Only ever non-zero when hasPricingSnapshot — bookings without a
    // pricing snapshot predate the promo-code feature entirely.
    let discountAmount = 0;

    if (hasPricingSnapshot) {
        pickupCharge = Number(booking.pickupCharges);
        dropCharge = Number(booking.dropCharges);
        subtotal = Number(booking.subtotal);
        taxRate = Number(booking.taxRate);
        taxAmount = Number(booking.taxAmount);
        discountAmount = Number(booking.discountAmount) || 0;
        // total_amount / "Total Paid" is what the customer actually paid —
        // customerTotal minus whatever discount (promo) was applied, i.e.
        // the same amountDue virtual payment.js charges against.
        totalAmount = round2(Number(booking.customerTotal) - discountAmount);
        commissionRate = Number(booking.commissionRate);
        commissionAmount = Number(booking.commissionAmount);
        dealerEarnings = Number(booking.dealerEarnings);
    } else {
        const dealer = booking.dealer_id;

        const hasPickupDrop = Boolean(booking.pickupAndDropId);
        pickupCharge = hasPickupDrop && dealer?.providesPickup ? parseFloat(dealer.pickupCharges) || 0 : 0;
        dropCharge = hasPickupDrop && dealer?.providesDrop ? parseFloat(dealer.dropCharges) || 0 : 0;

        subtotal += pickupCharge + dropCharge;

        taxRate = parseFloat(dealer?.tax) || 0;
        taxAmount = (subtotal * taxRate) / 100;
        totalAmount = subtotal + taxAmount;

        commissionRate = parseFloat(dealer?.commission) || 0;
        commissionAmount = parseFloat(((subtotal * commissionRate) / 100).toFixed(2));
        dealerEarnings = parseFloat((subtotal - commissionAmount).toFixed(2));
    }

    if (pickupCharge > 0) {
        services.push({ name: "Pickup Charges", price: pickupCharge, quantity: 1, total: pickupCharge });
    }
    if (dropCharge > 0) {
        services.push({ name: "Drop Charges", price: dropCharge, quantity: 1, total: dropCharge });
    }

    const billNumber = await generateInvoiceNumber();

    const variant = booking.userBike_id?.variant_id;
    const model = variant?.model_id;
    const company = model?.company_id;

    const bill = new Bill({
        booking_id: booking._id,
        booking_number: booking.bookingId || null,
        payment_id: paymentMeta.payment_id || null,
        bill_number: billNumber,
        bill_date: new Date(),
        customer_details: {
            name: `${booking.user_id.first_name} ${booking.user_id.last_name}`,
            email: booking.user_id.email,
            phone: booking.user_id.phone,
        },
        dealer_details: resolveDealerDetails(booking.dealer_id),
        bike_details: {
            model: booking.userBike_id?.model || "N/A",
            registration: booking.userBike_id?.registration_number || "N/A",
            vin: booking.userBike_id?.vin || "N/A",
            company: company?.name || null,
            engine_cc: variant?.engine_cc ?? bikeCC ?? null,
        },
        services: services,
        subtotal: subtotal,
        pickup_charges: pickupCharge,
        drop_charges: dropCharge,
        tax_amount: taxAmount,
        tax_rate: taxRate,
        discount_amount: discountAmount,
        promo_code: booking.promoCode || null,
        promo_name: booking.promoName || null,
        total_amount: totalAmount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        dealer_earnings: dealerEarnings,
        payment_details: {
            payment_method: paymentMeta.payment_method || "online",
            transaction_id: paymentMeta.transaction_id,
            payment_date: new Date(),
        },
        status: "generated",
    });

    try {
        await bill.save();
    } catch (error) {
        if (error?.code === 11000) {
            const concurrentBill = await Bill.findOne({ booking_id: bookingId });
            if (concurrentBill) return concurrentBill;
        }
        throw error;
    }
    console.log(`✅ Invoice generated: ${billNumber} for booking: ${booking._id}`);

    // Promo usage is NOT touched here. Per the final business rule, a promo
    // is consumed exactly once — when the dealer confirms the booking (see
    // controller/booking.js#updateBookingStatus) — and payment/invoice
    // generation are fully independent of that. This function only reads
    // booking.promoCode/promoName/discountAmount above to DISPLAY the
    // already-locked snapshot; it must never create a PromoCodeUsage or
    // increment PromoCode.usedCount.

    if (hasPricingSnapshot) {
        await Booking.findByIdAndUpdate(booking._id, { $set: { billGenerated: true } });
    } else {
        await Booking.findByIdAndUpdate(
            booking._id,
            {
                $set: {
                    billGenerated: true,
                    tax: taxAmount,
                    totalBill: subtotal,
                    pickupCharges: pickupCharge,
                    dropCharges: dropCharge,
                },
            },
            { [PRICING_WRITE_BYPASS_FLAG]: true }
        );
    }

    return bill;
}

// Pure mapping, no DB access — the single shape all three frontends
// (User App, Dealer App, Admin Panel) render identically.
function buildInvoiceResponse(bill) {
    return {
        invoiceNumber: bill.bill_number,
        bookingId: bill.booking_id,
        bookingNumber: bill.booking_number || null,
        invoiceDate: bill.bill_date,
        paymentMethod: bill.payment_details?.payment_method || null,
        paymentStatus: bill.status,
        dealer: {
            name: bill.dealer_details?.name || null,
            address: bill.dealer_details?.address || null,
            phone: bill.dealer_details?.phone || null,
            gstNumber: bill.dealer_details?.gst_number || null,
            logoUrl: bill.dealer_details?.logo_url || null,
        },
        customer: {
            name: bill.customer_details?.name || null,
            mobile: bill.customer_details?.phone || null,
        },
        bike: {
            company: bill.bike_details?.company || null,
            model: bill.bike_details?.model || null,
            registrationNumber: bill.bike_details?.registration || null,
            engineCc: bill.bike_details?.engine_cc ?? null,
        },
        services: (bill.services || []).map((s) => ({
            name: s.name,
            quantity: s.quantity,
            price: s.price,
            total: s.total,
        })),
        charges: {
            pickupCharge: bill.pickup_charges || 0,
            dropCharge: bill.drop_charges || 0,
        },
        subtotal: bill.subtotal,
        tax: { rate: bill.tax_rate, amount: bill.tax_amount },
        discount: bill.promo_code
            ? { code: bill.promo_code, name: bill.promo_name || null, amount: bill.discount_amount || 0 }
            : null,
        totalPaid: bill.total_amount,
        settlement: {
            commissionRate: bill.commission_rate,
            commissionAmount: bill.commission_amount,
            dealerPayout: bill.dealer_earnings,
        },
    };
}

module.exports = {
    generateInvoiceNumber,
    getOrCreateInvoice,
    buildInvoiceResponse,
};
