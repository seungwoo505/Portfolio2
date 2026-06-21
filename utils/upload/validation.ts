const path = require('path');

type ImageType = {
    extensions: string[];
    extension: string;
};

type UploadFileLike = {
    mimetype?: string;
    originalname?: string;
} | null | undefined;

type UploadValidationError = Error & {
    code?: string;
    statusCode?: number;
};

const allowedImageTypes = new Map<string, ImageType>([
    ['image/jpeg', { extensions: ['.jpg', '.jpeg'], extension: '.jpg' }],
    ['image/jpg', { extensions: ['.jpg', '.jpeg'], extension: '.jpg' }],
    ['image/png', { extensions: ['.png'], extension: '.png' }],
    ['image/gif', { extensions: ['.gif'], extension: '.gif' }],
    ['image/webp', { extensions: ['.webp'], extension: '.webp' }]
]);

const createUploadError = (message: string, code: string, statusCode = 400): UploadValidationError => {
    const error = new Error(message) as UploadValidationError;
    error.code = code;
    error.statusCode = statusCode;
    return error;
};

const validateImageFile = (file: UploadFileLike): ImageType => {
    const imageType = allowedImageTypes.get(file?.mimetype || '');
    if (!imageType) {
        throw createUploadError('지원되지 않는 이미지 형식입니다.', 'UNSUPPORTED_IMAGE_TYPE');
    }

    const ext = path.extname(file?.originalname || '').toLowerCase();
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

export {};
