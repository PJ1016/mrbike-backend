const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Creates a multer upload middleware that stores files in S3.
 * @param {string} folder - S3 folder/prefix e.g. "dealer-documents"
 */
function createS3Upload(folder) {
  return multer({
    storage: multerS3({
      s3,
      bucket: BUCKET,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, `${folder}/${filename}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      const allowed = [".jpg", ".jpeg", ".png", ".pdf", ".webp"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) cb(null, true);
      else cb(new Error(`Invalid file type. Allowed: ${allowed.join(", ")}`), false);
    },
  });
}

module.exports = { createS3Upload };
