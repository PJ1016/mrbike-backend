/**
 * Seeds / resets the single Super Admin account.
 *
 * - Creates admin@mrbikedoctor.com if it does not exist, or updates it in-place.
 * - Deactivates every other admin account (all roles).
 * - Never touches JWT logic, routes, or schema.
 *
 * Run:  node scripts/seedSuperAdmin.js
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const Admin = require("../models/admin_model");

const MONGO_URI =
  process.env.DATABASE_URL ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/bikedocter";

const SUPER_ADMIN_EMAIL = "admin@mrbikedoctor.com";
const SUPER_ADMIN_PLAIN_PASSWORD = "Admin@123";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB:", MONGO_URI.replace(/:\/\/.*@/, "://<credentials>@"));

  // Hash using the same approach as the codebase (bcryptjs, 10 rounds)
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(SUPER_ADMIN_PLAIN_PASSWORD, salt);

  const existing = await Admin.findOne({ email: SUPER_ADMIN_EMAIL });

  if (existing) {
    // Update in-place — ID is already set so the pre-validate hook will not regenerate it
    existing.name = "Super Admin";
    existing.password = hashedPassword;
    existing.role = "Admin";
    existing.status = "active";
    await existing.save();
    console.log(`[UPDATE] Super Admin already existed — password, role, and status refreshed.`);
    console.log(`         ID: ${existing.ID}  |  email: ${existing.email}`);
  } else {
    // New document — pre-validate hook will auto-generate the ID (e.g. MKBDA-001)
    const newAdmin = new Admin({
      name: "Super Admin",
      email: SUPER_ADMIN_EMAIL,
      password: hashedPassword,
      role: "Admin",
      mobile: "9999999999",
      status: "active",
    });
    await newAdmin.save();
    console.log(`[CREATE] Super Admin created.`);
    console.log(`         ID: ${newAdmin.ID}  |  email: ${newAdmin.email}`);
  }

  // Deactivate all other accounts (Admin, Manager, Executive, Telecaller, Subadmin)
  const result = await Admin.updateMany(
    { email: { $ne: SUPER_ADMIN_EMAIL } },
    { $set: { status: "inactive" } }
  );
  console.log(`[DEACTIVATE] ${result.modifiedCount} other admin account(s) set to inactive.`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
