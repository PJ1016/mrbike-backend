const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
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

// Defaults preserve the exact behavior every existing caller already relies
// on. Note video types are deliberately absent: nothing in this codebase can
// serve or play a self-hosted video today (the user app ships
// react-native-youtube-iframe, not a native player), so service videos are
// YouTube URLs normalized through utils/youtube.js instead.
const DEFAULT_ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf", ".webp"];
const DEFAULT_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Creates a multer upload middleware that stores files in S3.
 * @param {string} folder - S3 folder/prefix e.g. "dealer-documents"
 * @param {object} [options] - optional overrides; omitting them keeps the
 *   historical behavior byte for byte.
 * @param {string[]} [options.allowedExtensions] - lowercase extensions incl. dot
 * @param {number} [options.maxFileSizeBytes]
 */
function createS3Upload(folder, options = {}) {
  const allowed = options.allowedExtensions || DEFAULT_ALLOWED_EXTENSIONS;
  const maxFileSizeBytes = options.maxFileSizeBytes || DEFAULT_MAX_FILE_SIZE_BYTES;

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
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) cb(null, true);
      else cb(new Error(`Invalid file type. Allowed: ${allowed.join(", ")}`), false);
    },
    limits: {
      fileSize: maxFileSizeBytes,
    },
  });
}

/**
 * Deletes a previously uploaded S3 object given its stored `.location` URL
 * (or a bare key). Used when a dealer document is replaced or removed so old
 * files don't leak in the bucket. Errors are logged, never thrown, so a
 * failed cleanup never blocks the surrounding dealer update.
 * @param {string} location - the multerS3 `.location` URL or S3 key
 */
async function deleteS3Object(location) {
  if (!location) return;
  try {
    const marker = ".amazonaws.com/";
    const key = location.includes(marker) ? decodeURIComponent(location.split(marker)[1]) : location;
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error("Error deleting S3 object:", location, err.message);
  }
}

module.exports = { createS3Upload, deleteS3Object, DEFAULT_ALLOWED_EXTENSIONS, DEFAULT_MAX_FILE_SIZE_BYTES };
