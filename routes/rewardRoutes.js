const express = require('express');
const router = express.Router();
const {createReward,getUserRewards,scratchReward,applyRewardPoints,getRewards,getRewardPoints} = require('../controller/reward');
const { requireCustomer, requireOwnCustomerBody } = require('../middlewares/customerAuth');
const { requireAdmin } = require('../middlewares/requireAdmin');

router.post('/create-reward', requireAdmin, createReward);

router.get('/user-rewards', requireCustomer, getUserRewards);

router.post('/scratch-reward', requireCustomer, scratchReward);

router.post('/apply-reward-points', requireCustomer, requireOwnCustomerBody("user_id"), applyRewardPoints);

router.get('/rewards', requireAdmin, getRewards);

router.get('/rewardPoints', requireCustomer, getRewardPoints);

module.exports = router;
