const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadImageDir = path.join(__dirname, '..', 'uploads', 'images');
const uploadMaxFileSize = Number(process.env.UPLOAD_MAX_FILE_SIZE || 5 * 1024 * 1024);

const ensureUploadImageDir = () => {
    if (!fs.existsSync(uploadImageDir)) {
        fs.mkdirSync(uploadImageDir, { recursive: true });
    }
};

const sanitizeBaseName = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    const baseName = path
        .basename(filename, ext)
        .replace(/[^a-zA-Z0-9가-힣]/g, '')
        .substring(0, 20);

    return baseName || 'image';
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureUploadImageDir();
        cb(null, uploadImageDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = sanitizeBaseName(file.originalname);
        cb(null, `${Date.now()}-${baseName}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
        return;
    }

    cb(new Error('지원되지 않는 이미지 형식입니다.'), false);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: uploadMaxFileSize
    }
});

const getUploadedImagePath = (filename) => path.join(uploadImageDir, filename);

module.exports = {
    upload,
    getUploadedImagePath,
    uploadImageDir
};
