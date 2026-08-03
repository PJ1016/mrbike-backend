const mongoose = require("mongoose");
const sanitizeHtml = require("sanitize-html");
const Booking = require("../models/Booking");
const Review = require("../models/rating_model");
const ReviewReply = require("../models/ReviewReply");
const ReviewImage = require("../models/ReviewImage");
const RatingSummary = require("../models/RatingSummary");
const Customer = require("../models/customer_model");
const Vendor = require("../models/dealerModel");

const CATEGORY_KEYS = ["mechanicBehaviour", "serviceQuality", "pickupExperience", "deliveryExperience", "timeManagement", "communication", "overallSatisfaction"];
const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const terminalStatuses = ["delivered", "cash received", "Payment"];

const clean = (value, max = 2000) => sanitizeHtml(String(value || ""), { allowedTags: [], allowedAttributes: {} }).trim().slice(0, max);
const objectId = (value) => mongoose.Types.ObjectId.isValid(value);
const paid = (booking) => booking.payment_method == null || booking.payment_status === "completed" || booking.billStatus === "paid" || ["cash received", "Payment", "delivered"].includes(booking.status);
const eligible = (booking) => Boolean(booking && !["cancelled", "user_cancelled", "rejected", "expired"].includes(booking.status) && terminalStatuses.includes(booking.status) && booking.billGenerated && paid(booking));

function parseCategories(value) {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch (_) { value = {}; } }
  const output = {};
  for (const key of CATEGORY_KEYS) {
    if (value?.[key] == null || value[key] === "") continue;
    const score = Number(value[key]);
    if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error(`Invalid category rating: ${key}`);
    output[key] = score;
  }
  return output;
}

async function recomputeSummaries(dealerId) {
  const match = { dealer_id: new mongoose.Types.ObjectId(dealerId), moderationStatus: "published", isArchived: { $ne: true } };
  const [rollup] = await Review.aggregate([
    { $match: match },
    { $group: { _id: null, averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 }, recommends: { $sum: { $cond: ["$recommend", 1, 0] } },
      one: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }, two: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } }, three: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } }, four: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } }, five: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
      ...Object.fromEntries(CATEGORY_KEYS.map(k => [k, { $avg: `$categoryRatings.${k}` }])) } }
  ]);
  const count = rollup?.reviewCount || 0;
  const summary = {
    averageRating: Number((rollup?.averageRating || 0).toFixed(2)), reviewCount: count,
    recommendationRate: count ? Number(((rollup.recommends / count) * 100).toFixed(1)) : 0,
    distribution: { 1: rollup?.one || 0, 2: rollup?.two || 0, 3: rollup?.three || 0, 4: rollup?.four || 0, 5: rollup?.five || 0 },
    categoryScores: Object.fromEntries(CATEGORY_KEYS.map(k => [k, Number((rollup?.[k] || 0).toFixed(2))])),
  };
  await Promise.all([
    RatingSummary.findOneAndUpdate({ entityType: "dealer", entityId: dealerId }, { $set: summary }, { upsert: true }),
    Vendor.updateOne({ _id: dealerId }, { $set: { averageRating: summary.averageRating, ratingCount: count } }),
  ]);
  return summary;
}

async function eligibility(req, res) {
  if (!objectId(req.params.bookingId)) return res.status(400).json({ success: false, message: "Invalid booking ID" });
  const booking = await Booking.findOne({ _id: req.params.bookingId, user_id: req.user_id }).lean();
  if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
  const review = await Review.findOne({ booking_id: booking._id }).lean();
  return res.json({ success: true, data: { eligible: eligible(booking) && !review, reviewed: Boolean(review), review, reason: review ? "already_reviewed" : eligible(booking) ? null : "booking_not_completed_paid_and_invoiced" } });
}

async function addreview(req, res) {
  try {
    const bookingId = req.body.booking_id || req.body.bookingId;
    const rating = Number(req.body.rating);
    if (!objectId(bookingId) || !Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: "booking_id and a whole-number rating from 1 to 5 are required" });
    const booking = await Booking.findOne({ _id: bookingId, user_id: req.user_id });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (!eligible(booking)) return res.status(409).json({ success: false, code: "REVIEW_NOT_ELIGIBLE", message: "The booking must be delivered, invoiced and paid before it can be reviewed" });
    const now = new Date();
    const review = await Review.create({
      booking_id: booking._id, user_id: req.user_id, dealer_id: booking.dealer_id, rating,
      comment: clean(req.body.comment || req.body.review), review: clean(req.body.review || req.body.comment), reason: clean(req.body.reason, 500),
      categoryRatings: parseCategories(req.body.categoryRatings), recommend: req.body.recommend === true || req.body.recommend === "true" ? true : req.body.recommend === false || req.body.recommend === "false" ? false : null,
      isAnonymous: req.body.isAnonymous === true || req.body.isAnonymous === "true", editExpiresAt: new Date(now.getTime() + EDIT_WINDOW_MS),
    });
    const images = (req.files || []).map(file => ({ review_id: review._id, url: file.location || file.path, key: file.key, mimeType: file.mimetype }));
    if (images.length) await ReviewImage.insertMany(images);
    booking.reviewStatus = "submitted"; booking.reviewId = review._id; booking.reviewSubmittedAt = now; await booking.save();
    await Promise.all([Customer.updateOne({ _id: req.user_id }, { $inc: { reviewCount: 1 } }), recomputeSummaries(booking.dealer_id)]);
    return res.status(201).json({ success: true, status: 201, message: "Review submitted", data: { ...review.toObject(), images } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, code: "DUPLICATE_REVIEW", message: "This booking has already been reviewed" });
    if (error.message?.startsWith("Invalid category")) return res.status(400).json({ success: false, message: error.message });
    console.error("addreview:", error); return res.status(500).json({ success: false, message: "Unable to submit review" });
  }
}

async function updateReview(req, res) {
  try {
    const review = await Review.findOne({ _id: req.params.id, user_id: req.user_id });
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    if (!review.editExpiresAt || review.editExpiresAt <= new Date()) return res.status(409).json({ success: false, code: "EDIT_WINDOW_EXPIRED", message: "Reviews can only be edited for 7 days" });
    if (req.body.rating != null) { const n = Number(req.body.rating); if (!Number.isInteger(n) || n < 1 || n > 5) return res.status(400).json({ success: false, message: "Rating must be from 1 to 5" }); review.rating = n; }
    if (req.body.comment != null || req.body.review != null) { review.comment = clean(req.body.comment || req.body.review); review.review = review.comment; }
    if (req.body.categoryRatings != null) review.categoryRatings = parseCategories(req.body.categoryRatings);
    if (req.body.recommend != null) review.recommend = req.body.recommend === true || req.body.recommend === "true";
    if (req.body.isAnonymous != null) review.isAnonymous = req.body.isAnonymous === true || req.body.isAnonymous === "true";
    review.lastEditedAt = new Date(); await review.save(); await recomputeSummaries(review.dealer_id);
    if (req.files?.length) await ReviewImage.insertMany(req.files.map(file => ({ review_id: review._id, url: file.location || file.path, key: file.key, mimeType: file.mimetype })));
    return res.json({ success: true, message: "Review updated", data: review });
  } catch (error) { console.error("updateReview:", error); return res.status(500).json({ success: false, message: "Unable to update review" }); }
}

function publicPipeline(match, skip = 0, limit = 20) {
  return Review.aggregate([{ $match: match }, { $sort: { isFeatured: -1, createdAt: -1 } }, { $skip: skip }, { $limit: limit },
    { $lookup: { from: "reviewimages", localField: "_id", foreignField: "review_id", as: "images" } }, { $lookup: { from: "reviewreplies", localField: "_id", foreignField: "review_id", as: "replies" } },
    { $lookup: { from: "customers", localField: "user_id", foreignField: "_id", as: "customer" } }, { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    { $set: { customer: { $cond: ["$isAnonymous", { first_name: "Anonymous", last_name: "Customer", image: "" }, { first_name: "$customer.first_name", last_name: "$customer.last_name", image: "$customer.image" }] } } },
    { $project: { "customer.phone": 0, "customer.email": 0 } }]);
}

async function getallreview(req, res) {
  const match = { moderationStatus: "published", isArchived: { $ne: true } };
  const requestedDealer = req.query.dealer_id || req.params.dealerId;
  if (requestedDealer) { if (!objectId(requestedDealer)) return res.status(400).json({ success: false, message: "Invalid dealer ID" }); match.dealer_id = new mongoose.Types.ObjectId(requestedDealer); }
  if (req.query.featured === "true") match.isFeatured = true;
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const [data, total] = await Promise.all([Review.aggregate(publicPipeline(match, (page - 1) * limit, limit)), Review.countDocuments(match)]);
  return res.json({ success: true, status: 200, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

async function dealerReviews(req, res) {
  const dealerId = req.params.dealerId;
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(50, Number(req.query.limit) || 20);
  const match = { dealer_id: new mongoose.Types.ObjectId(dealerId), moderationStatus: { $ne: "spam" }, isArchived: { $ne: true } };
  const [reviews, summary] = await Promise.all([Review.aggregate(publicPipeline(match, (page - 1) * limit, limit)), RatingSummary.findOne({ entityType: "dealer", entityId: dealerId }).lean()]);
  return res.json({ success: true, data: { summary: summary || await recomputeSummaries(dealerId), reviews } });
}

async function aggregateRating(req, res) {
  const { entity = "global", id } = req.query;
  if (!["global", "dealer", "service"].includes(entity) || (entity !== "global" && !objectId(id))) return res.status(400).json({ success: false, message: "entity must be global, dealer, or service with a valid id" });
  let pipeline = [{ $match: { moderationStatus: "published", isArchived: { $ne: true } } }];
  if (entity === "dealer") pipeline[0].$match.dealer_id = new mongoose.Types.ObjectId(id);
  if (entity === "service") pipeline.push({ $lookup: { from: "bookings", localField: "booking_id", foreignField: "_id", as: "booking" } }, { $unwind: "$booking" }, { $match: { "booking.services": new mongoose.Types.ObjectId(id) } });
  pipeline.push({ $group: { _id: null, ratingValue: { $avg: "$rating" }, reviewCount: { $sum: 1 }, bestRating: { $max: "$rating" }, worstRating: { $min: "$rating" } } });
  const [value] = await Review.aggregate(pipeline);
  const data = { ratingValue: Number((value?.ratingValue || 0).toFixed(2)), reviewCount: value?.reviewCount || 0, bestRating: value?.bestRating || 5, worstRating: value?.worstRating || 1 };
  return res.json({ success: true, data, schema: { "@context": "https://schema.org", "@type": "AggregateRating", ...data } });
}

async function reply(req, res) {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: "Review not found" });
  const authorType = req.admin_id ? "admin" : "dealer", authorId = req.admin_id || req.dealer_id;
  if (authorType === "dealer" && String(review.dealer_id) !== String(authorId)) return res.status(403).json({ success: false, message: "Access denied" });
  try { const result = await ReviewReply.create({ review_id: review._id, authorType, authorId, body: clean(req.body.body, 1000) }); return res.status(201).json({ success: true, data: result }); }
  catch (error) { if (error.code === 11000) return res.status(409).json({ success: false, message: "A reply already exists for this review" }); throw error; }
}

function adminMatch(query) {
  const match = {};
  if (query.dealer && objectId(query.dealer)) match.dealer_id = new mongoose.Types.ObjectId(query.dealer);
  if (query.customer && objectId(query.customer)) match.user_id = new mongoose.Types.ObjectId(query.customer);
  if (query.rating) match.rating = Number(query.rating);
  if (query.from || query.to) match.createdAt = { ...(query.from && { $gte: new Date(query.from) }), ...(query.to && { $lte: new Date(`${query.to}T23:59:59.999Z`) }) };
  if (query.status) match.moderationStatus = query.status;
  return match;
}

async function adminList(req, res) {
  const match = adminMatch(req.query), page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Number(req.query.limit) || 25);
  const [data, total] = await Promise.all([Review.find(match).populate("user_id", "first_name last_name phone city").populate("dealer_id", "shopName city averageRating").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Review.countDocuments(match)]);
  const ids = data.map(x => x._id), [images, replies] = await Promise.all([ReviewImage.find({ review_id: { $in: ids } }).lean(), ReviewReply.find({ review_id: { $in: ids } }).lean()]);
  return res.json({ success: true, data: data.map(r => ({ ...r, images: images.filter(i => String(i.review_id) === String(r._id)), reply: replies.find(i => String(i.review_id) === String(r._id)) || null })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

async function analytics(req, res) {
  const match = adminMatch(req.query);
  const [stats, trend, dealers, pendingReplies] = await Promise.all([
    Review.aggregate([{ $match: { ...match, moderationStatus: "published" } }, { $group: { _id: null, averageRating: { $avg: "$rating" }, count: { $sum: 1 }, one: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }, two: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } }, three: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } }, four: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } }, five: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } } } }]),
    Review.aggregate([{ $match: { ...match, moderationStatus: "published" } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, average: { $avg: "$rating" }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 90 }]),
    RatingSummary.find({ entityType: "dealer" }).sort({ reviewCount: -1 }).limit(20).populate("entityId", "shopName city").lean(),
    Review.aggregate([{ $match: { ...match, moderationStatus: "published" } }, { $lookup: { from: "reviewreplies", localField: "_id", foreignField: "review_id", as: "reply" } }, { $match: { reply: { $size: 0 } } }, { $count: "count" }]),
  ]);
  const s = stats[0] || {};
  return res.json({ success: true, data: { averageRating: Number((s.averageRating || 0).toFixed(2)), reviewCount: s.count || 0, distribution: { 1: s.one || 0, 2: s.two || 0, 3: s.three || 0, 4: s.four || 0, 5: s.five || 0 }, trend, dealers, pendingReplies: pendingReplies[0]?.count || 0 } });
}

async function moderate(req, res) {
  const review = await Review.findById(req.params.id); if (!review) return res.status(404).json({ success: false, message: "Review not found" });
  if (req.body.action === "hide") review.moderationStatus = "hidden"; else if (req.body.action === "publish") review.moderationStatus = "published"; else if (req.body.action === "spam") review.moderationStatus = "spam"; else if (req.body.action === "feature") review.isFeatured = true; else if (req.body.action === "unfeature") review.isFeatured = false; else return res.status(400).json({ success: false, message: "Invalid moderation action" });
  await review.save(); await recomputeSummaries(review.dealer_id); return res.json({ success: true, data: review });
}

async function removeSpam(req, res) {
  const review = await Review.findOne({ _id: req.params.id, moderationStatus: "spam" }); if (!review) return res.status(409).json({ success: false, message: "Only reviews marked as spam can be deleted" });
  await Promise.all([ReviewImage.deleteMany({ review_id: review._id }), ReviewReply.deleteMany({ review_id: review._id }), Booking.updateOne({ _id: review.booking_id }, { $set: { reviewStatus: "pending", reviewId: null, reviewSubmittedAt: null } }), Customer.updateOne({ _id: review.user_id }, { $inc: { reviewCount: -1 } }), review.deleteOne()]);
  await recomputeSummaries(review.dealer_id); return res.json({ success: true, message: "Spam review deleted" });
}

async function exportCsv(req, res) {
  const rows = await Review.find(adminMatch(req.query)).populate("user_id", "first_name last_name phone city").populate("dealer_id", "shopName city").sort({ createdAt: -1 }).lean();
  const esc = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [["Date", "Booking", "Dealer", "City", "Customer", "Rating", "Review", "Recommend", "Status", "Featured"], ...rows.map(r => [r.createdAt?.toISOString(), r.booking_id, r.dealer_id?.shopName, r.dealer_id?.city, r.isAnonymous ? "Anonymous" : `${r.user_id?.first_name || ""} ${r.user_id?.last_name || ""}`.trim(), r.rating, r.comment, r.recommend, r.moderationStatus, r.isFeatured])].map(row => row.map(esc).join(",")).join("\n");
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="reviews-${new Date().toISOString().slice(0,10)}.csv"` }); return res.send(csv);
}

module.exports = { addreview, updateReview, eligibility, getallreview, dealerReviews, aggregateRating, reply, adminList, analytics, moderate, removeSpam, exportCsv, recomputeSummaries, eligible };
