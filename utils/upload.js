const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parseIntegerEnv } = require('./env-number');

const uploadImageDir = path.join(__dirname, '..', 'uploads', 'images');
const defaultUploadMaxFileSize = 5 * 1024 * 1024;
const uploadMaxFileSize = parseIntegerEnv(process.env.UPLOAD_MAX_FILE_SIZE, {
    fallback: defaultUploadMaxFileSize,
    min: 1024 * 1024,
    max: 50 * 1024 * 1024
});
const uploadedImageFilenamePattern = /^\d+-[a-zA-Z0-9가-힣]+\.(jpe?g|png|gif|webp)$/i;
const allowedImageTypes = new Map([
    ['image/jpeg', { extensions: ['.jpg', '.jpeg'], extension: '.jpg' }],
    ['image/jpg', { extensions: ['.jpg', '.jpeg'], extension: '.jpg' }],
    ['image/png', { extensions: ['.png'], extension: '.png' }],
    ['image/gif', { extensions: ['.gif'], extension: '.gif' }],
    ['image/webp', { extensions: ['.webp'], extension: '.webp' }]
]);

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

const createUploadError = (message, code, statusCode = 400) => {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
};

const validateImageFile = (file) => {
    const imageType = allowedImageTypes.get(file?.mimetype);
    if (!imageType) {
        throw createUploadError('지원되지 않는 이미지 형식입니다.', 'UNSUPPORTED_IMAGE_TYPE');
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext || !imageType.extensions.includes(ext)) {
        throw createUploadError('이미지 MIME 타입과 파일 확장자가 일치하지 않습니다.', 'INVALID_IMAGE_EXTENSION');
    }

    return imageType;
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureUploadImageDir();
        cb(null, uploadImageDir);
    },
    filename: (req, file, cb) => {
        try {
            const imageType = validateImageFile(file);
            const baseName = sanitizeBaseName(file.originalname);
            cb(null, `${Date.now()}-${baseName}${imageType.extension}`);
        } catch (error) {
            cb(error);
        }
    }
});

const fileFilter = (req, file, cb) => {
    try {
        validateImageFile(file);
        cb(null, true);
    } catch (error) {
        cb(error, false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: uploadMaxFileSize
    }
});

const isSafeUploadedImageFilename = (filename) => {
    if (typeof filename !== 'string' || !filename.trim()) {
        return false;
    }

    const basename = path.basename(filename);
    if (basename !== filename || !uploadedImageFilenamePattern.test(basename)) {
        return false;
    }

    const uploadRoot = path.resolve(uploadImageDir);
    const resolvedPath = path.resolve(uploadRoot, basename);
    return resolvedPath.startsWith(`${uploadRoot}${path.sep}`);
};

const getUploadedImagePath = (filename) => path.resolve(uploadImageDir, path.basename(filename));

const sendUploadError = (res, error) => {
    const statusCode = error.code === 'LIMIT_FILE_SIZE'
        ? 413
        : error.statusCode || 400;
    const message = error.code === 'LIMIT_FILE_SIZE'
        ? `이미지 파일 크기는 ${Math.floor(uploadMaxFileSize / 1024 / 1024)}MB를 초과할 수 없습니다.`
        : error.message || '이미지 업로드 요청이 올바르지 않습니다.';

    return res.status(statusCode).json({
        success: false,
        message
    });
};

const uploadImage = (req, res, next) => {
    upload.single('image')(req, res, (error) => {
        if (!error) {
            return next();
        }

        return sendUploadError(res, error);
    });
};

module.exports = {
    upload,
    uploadImage,
    getUploadedImagePath,
    isSafeUploadedImageFilename,
    validateImageFile,
    uploadImageDir,
    uploadMaxFileSize
};
