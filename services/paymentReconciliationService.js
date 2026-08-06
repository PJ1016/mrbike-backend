const PaymentReconciliationTask = require("../models/PaymentReconciliationTask");

const DEFAULT_TASKS = ["BOOKING_SYNC", "INVOICE", "WALLET", "NOTIFICATION"];

async function enqueuePaymentReconciliation(payment, taskTypes = DEFAULT_TASKS, session = null) {
  if (!payment?.booking_id) return;
  const paymentId = payment._id || payment.payment_id;
  const operations = taskTypes.map((taskType) => ({
    updateOne: {
      filter: { dedupeKey: `${taskType}:${payment.booking_id}:${paymentId || "none"}` },
      update: {
        $setOnInsert: {
          dedupeKey: `${taskType}:${payment.booking_id}:${paymentId || "none"}`,
          taskType,
          booking_id: payment.booking_id,
          payment_id: paymentId || null,
          status: "PENDING",
          nextAttemptAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  await PaymentReconciliationTask.bulkWrite(operations, session ? { session } : undefined);
}

async function completeReconciliationTask(payment, taskType) {
  if (!payment?.booking_id) return;
  await PaymentReconciliationTask.updateMany(
    {
      booking_id: payment.booking_id,
      taskType,
      status: { $ne: "COMPLETED" },
    },
    {
      $set: { status: "COMPLETED", completedAt: new Date(), lockedUntil: null, lastError: null },
    },
  );
}

module.exports = {
  DEFAULT_TASKS,
  enqueuePaymentReconciliation,
  completeReconciliationTask,
};
