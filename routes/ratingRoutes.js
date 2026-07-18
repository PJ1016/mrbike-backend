var router = require('express').Router();
var multer = require('multer');
var fs = require('fs-extra');

const { addreview, getallreview } = require('../controller/ratingController');



/* POST users listing. */
router.post('/add', addreview);
router.get('/list', getallreview);



module.exports = router;