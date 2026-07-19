const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../middlewares/requireAdmin");
const {
  getRewardRules,
  getRewardRuleById,
  createRewardRule,
  updateRewardRule,
  deleteRewardRule,
  toggleRewardRuleStatus,
  bulkDeleteRewardRules,
  bulkUpdateRewardRuleStatus,
} = require("../../controller/preferences/rewardRuleController");

router.post("/:ruleType/bulk-delete", requireAdmin, bulkDeleteRewardRules);
router.post("/:ruleType/bulk-status", requireAdmin, bulkUpdateRewardRuleStatus);
router.patch("/:ruleType/:id/status", requireAdmin, toggleRewardRuleStatus);
router.get("/:ruleType/:id", requireAdmin, getRewardRuleById);
router.put("/:ruleType/:id", requireAdmin, updateRewardRule);
router.delete("/:ruleType/:id", requireAdmin, deleteRewardRule);
router.get("/:ruleType", requireAdmin, getRewardRules);
router.post("/:ruleType", requireAdmin, createRewardRule);

module.exports = router;
