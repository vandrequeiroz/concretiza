const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOADS = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename:    (req, file, cb) => {
    const uid = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, uid + path.extname(file.originalname));
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Apenas imagens são permitidas'))
});
