const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const { uploadId, uploadSelfie, verifyKyc } = require('../controllers/kycController');
const { authenticate, authorize } = require('../middleware/authenticate');
const { kycUploadRateLimiter } = require('../middleware/rateLimiter');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `kyc-${req.user.id}-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error('Only JPG, PNG, and PDF files are accepted.'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024 },
});

router.post('/upload-id',
  authenticate,
  authorize('CUSTOMER'),
  kycUploadRateLimiter,
  upload.single('idDocument'),
  uploadId
);

router.post('/upload-selfie',
  authenticate,
  authorize('CUSTOMER'),
  kycUploadRateLimiter,
  upload.single('selfie'),
  uploadSelfie
);

router.post('/verify',
  authenticate,
  authorize('CUSTOMER'),
  verifyKyc
);

module.exports = router;
