import type { NextFunction, Request, Response } from 'express';

const multer = require('multer');
const crypto = require('crypto');
const logger = require('../../log');
const { parseIntegerEnv } = require('../env-number');
const {
    ensureUploadImageDir,
    sanitizeBaseName,
    uploadImageDir
} = require('./paths');
const { validateImageFile } = require('./validation');
const { sendError } = require('../api-response');

type UploadError = Error & {
    code?: string;
    statusCode?: number;
};

type MulterCallback = (error: UploadError | null, value?: string | boolean) => void;

const defaultUploadMaxFileSize = 5 * 1024 * 1024;
const uploadMaxFileSize = parseIntegerEnv(process.env.UPLOAD_MAX_FILE_SIZE, {
    fallback: defaultUploadMaxFileSize,
    min: 1024 * 1024,
    max: 50 * 1024 * 1024
});
// Busboy의 잘못된 multipart 입력 오류는 별도 타입이나 코드 없이 전달된다.
const multipartInputErrorMessages = new Set([
    'Multipart: Boundary not found',
    'Malformed content type',
    'Malformed part header',
    'Unexpected end of form',
    'Unexpected end of file'
]);

const storage = multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: MulterCallback) => {
        try {
            ensureUploadImageDir();
        } catch (error) {
            return cb(error as UploadError);
        }
        cb(null, uploadImageDir);
    },
    filename: (_req: Request, file: Express.Multer.File, cb: MulterCallback) => {
        try {
            const imageType = validateImageFile(file);
            const baseName = sanitizeBaseName(file.originalname);
            const uniqueSuffix = crypto.randomBytes(16).toString('hex');
            cb(null, `${Date.now()}-${baseName}-${uniqueSuffix}${imageType.extension}`);
        } catch (error) {
            cb(error as UploadError);
        }
    }
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: MulterCallback) => {
    try {
        validateImageFile(file);
        cb(null, true);
    } catch (error) {
        cb(error as UploadError, false);
    }
};

const upload = multer({
    defParamCharset: 'utf8',
    storage,
    fileFilter,
    limits: {
        fileSize: uploadMaxFileSize
    }
});

const sendUploadError = (res: Response, error: UploadError) => {
    if (error instanceof multer.MulterError) {
        const sizeLimitExceeded = error.code === 'LIMIT_FILE_SIZE';
        return sendError(res, sizeLimitExceeded ? 413 : 400, sizeLimitExceeded
            ? `이미지 파일 크기는 ${Math.floor(uploadMaxFileSize / 1024 / 1024)}MB를 초과할 수 없습니다.`
            : error.message || '이미지 업로드 요청이 올바르지 않습니다.');
    }

    if (error.statusCode === 400 && (
        error.code === 'UNSUPPORTED_IMAGE_TYPE'
        || error.code === 'INVALID_IMAGE_EXTENSION'
    )) {
        return sendError(res, 400, error.message);
    }

    if (!error.code && (
        multipartInputErrorMessages.has(error.message)
        || error.message.startsWith('Unsupported content type: ')
    )) {
        return sendError(res, 400, '이미지 업로드 요청이 올바르지 않습니다.');
    }

    logger.error('이미지 업로드 실패', {
        error: error.message,
        code: error.code,
        stack: error.stack
    });
    return sendError(res, 500, '이미지 업로드에 실패했습니다.');
};

const uploadImage = (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, (error: UploadError | undefined) => {
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
