var express = require("express")
var multer = require("multer")
var fs = require("fs-extra")
const router = express.Router()
const { requireAdmin } = require("../middlewares/requireAdmin")
var { addfeature, getfeature, deletefeature, editfeature, getAllfeature } = require("../controller/service_features")

// Store data
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    var path = `./image`
    fs.mkdirsSync(path)
    //callback(null, 'uploads')
    callback(null, path)
  },
  filename: (req, file, callback) => {
    // image.jpg
    var ext = file.originalname.substring(file.originalname.lastIndexOf("."))
    return callback(null, file.fieldname + "-" + Date.now() + ext)
    //callback(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    //callback(null, file.originalname)
    // save file as original name
    // callback(null, file.originalname + ext)
  },
})

const upload = multer({
  storage: storage,
})

router.post("/addfeature", requireAdmin, upload.single("images"), addfeature)
router.get("/getfeature/:id", getfeature)
router.get("/getallfeature", getAllfeature)
router.delete("/deletefeature", requireAdmin, deletefeature)
router.put("/updatefeature/:id", requireAdmin, editfeature)

module.exports = router
