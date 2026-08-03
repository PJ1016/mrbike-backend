var express = require('express');
var multer = require('multer');
var fs = require('fs-extra');

var { addoffer,offerlist,deleteoffer,editoffer, Singleoffer,applyPromoCode } =  require('../controller/offer');
const router = express.Router();
const { requireAdmin } = require('../middlewares/requireAdmin');
const { requireCustomer } = require('../middlewares/customerAuth');

console.log("✅ Offer routes loaded, addoffer function:", typeof addoffer);

/* POST users listing. */
router.post('/addoffer', requireAdmin, (req, res, next) => {
  console.log("📍 POST /addoffer route hit");
  addoffer(req, res, next);
});
router.get('/offerlist',offerlist);
router.delete('/deleteoffer', requireAdmin, deleteoffer);
router.put('/editoffer', requireAdmin, editoffer);
router.put('/editoffer/:id', requireAdmin, editoffer);
router.get('/Singleoffer/:id',Singleoffer);
router.post("/applyPromo", requireCustomer, applyPromoCode);

module.exports = router;
