const multer = require('multer');
const { parseIntegerEnv } = require('../env-number');
const {
    ensureUploadImageDir,
    sanitizeBaseName,
    uploadImageDir
} = require('./paths');
const { validateImageFile } = require('./validation');

const defaultUploadMaxFileSize = 5 * 1024 * 1024;
const uploadMaxFileSize = parseIntegerEnv(process.env.UPLOAD_MAX_FILE_SIZE, {
    fallback: defaultUploadMaxFileSize,
    min: 1024 * 1024,
    max: 50 * 1024 * 1024
});

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
    defaultUploadMaxFileSize,
    fileFilter,
    sendUploadError,
    storage,
    upload,
    uploadImage,
    uploadMaxFileSize
};
