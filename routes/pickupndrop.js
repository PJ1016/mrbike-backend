var express = require('express');
var multer = require('multer');
var fs = require('fs-extra');
const router = express.Router();
const { requireCustomer, requireOwnCustomerBody } = require("../middlewares/customerAuth");
var {PicknDrop} = require("../controller/pickupndrop");

// Store data
const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        var path = `./upload/pickupndrop`;
        fs.mkdirsSync(path);
        callback(null, path);
    },
    filename(req, file, callback) {
        callback(null, Date.now() + '_' + file.originalname);
    },
});
const upload = multer({ storage });

router.post('/addpickndrop', requireCustomer, requireOwnCustomerBody("user_id"), PicknDrop);



module.exports = router;
