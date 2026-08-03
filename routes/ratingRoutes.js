var router = require('express').Router();
var multer = require('multer');
var fs = require('fs-extra');

const { addreview, getallreview } = require('../controller/ratingController');
const { requireCustomer } = require('../middlewares/customerAuth');



/* POST users listing. */
router.post('/add', requireCustomer, addreview);
router.get('/list', getallreview);



module.exports = router;
