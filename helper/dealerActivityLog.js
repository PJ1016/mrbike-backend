const DealerActivityLog = require("../models/DealerActivityLog");

async function logDealerActivity({ dealerId, adminId, action, reason }) {
  try {
    await DealerActivityLog.create({ dealerId, adminId, action, reason });
  } catch (err) {
    console.error(`[DEALER-ACTIVITY-LOG-FAILED] ${action} → dealer:${dealerId} | ${err.message}`);
  }
}

module.exports = { logDealerActivity };
