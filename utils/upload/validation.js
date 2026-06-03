const path = require('path');

const allowedImageTypes = new Map([
    ['image/jpeg', { extensions: ['.jpg', '.jpeg'], extension: '.jpg' }],
    ['image/jpg', { extensions: ['.jpg', '.jpeg'], extension: '.jpg' }],
    ['image/png', { extensions: ['.png'], extension: '.png' }],
    ['image/gif', { extensions: ['.gif'], extension: '.gif' }],
    ['image/webp', { extensions: ['.webp'], extension: '.webp' }]
]);

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

module.exports = {
    allowedImageTypes,
    createUploadError,
    validateImageFile
};
