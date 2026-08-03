require("dotenv").config();
const mongoose = require("mongoose");
const Banner = require("../models/banner_model");
const AppBanner = require("../models/AppBanner");

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!databaseUrl) throw new Error("DATABASE_URL or MONGODB_URI is required");

  await mongoose.connect(databaseUrl);
  const legacyBanners = await Banner.find({}).lean();

  for (const banner of legacyBanners) {
    await AppBanner.updateOne(
      { legacyBannerId: banner._id },
      {
        $setOnInsert: {
          bannerType: "home",
          image: banner.banner_image,
          title: banner.name || "Home banner",
          description: "",
          linkUrl: banner.baseServiceId ? `/services/${banner.baseServiceId}` : "",
          displayOrder: banner.displayOrder || 0,
          scheduleStart: banner.from_date || null,
          scheduleEnd: banner.expiry_date || null,
          // Upcoming records stay enabled and are held back by scheduleStart;
          // expired records stay disabled even if their old status was stale.
          isActive: banner.status !== "expired",
          isDeleted: false,
          locationType: banner.locationType === "specific" ? "specific" : "all",
          placeName: banner.placeName || "",
          latitude: banner.latitude ?? null,
          longitude: banner.longitude ?? null,
          radiusKm: banner.radius || 10,
          legacyBannerId: banner._id,
        },
      },
      { upsert: true },
    );
  }

  console.log(`Migrated ${legacyBanners.length} legacy Home banner(s) into AppBanner`);
  await mongoose.connection.close();
}

migrate().catch(async (error) => {
  console.error("Legacy Home banner migration failed:", error);
  await mongoose.connection.close().catch(() => {});
  process.exitCode = 1;
});
