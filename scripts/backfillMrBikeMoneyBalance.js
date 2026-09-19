require("dotenv").config();
const mongoose = require("mongoose");
const Customer = require("../models/customer_model");

async function run() {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URL;
  if (!uri) throw new Error("MongoDB connection string is not configured");
  await mongoose.connect(uri);

  const cursor = Customer.find({ mrBikeMoneyBalance: { $exists: false } })
    .select("referralEarnings")
    .cursor();
  let updated = 0;
  for await (const customer of cursor) {
    await Customer.updateOne(
      { _id: customer._id, mrBikeMoneyBalance: { $exists: false } },
      { $set: { mrBikeMoneyBalance: Math.max(0, Number(customer.referralEarnings) || 0) } }
    );
    updated += 1;
  }
  console.log(`Backfilled MR Bike Money balance for ${updated} customer(s).`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
