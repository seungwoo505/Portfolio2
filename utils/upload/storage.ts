import type { NextFunction, Request, Response } from 'express';

const multer = require('multer');
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

const storage = multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: MulterCallback) => {
        ensureUploadImageDir();
        cb(null, uploadImageDir);
    },
    filename: (_req: Request, file: Express.Multer.File, cb: MulterCallback) => {
        try {
            const imageType = validateImageFile(file);
            const baseName = sanitizeBaseName(file.originalname);
            cb(null, `${Date.now()}-${baseName}${imageType.extension}`);
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
    storage,
    fileFilter,
    limits: {
        fileSize: uploadMaxFileSize
    }
});

const sendUploadError = (res: Response, error: UploadError) => {
    const statusCode = error.code === 'LIMIT_FILE_SIZE'
        ? 413
        : error.statusCode || 400;
    const message = error.code === 'LIMIT_FILE_SIZE'
        ? `이미지 파일 크기는 ${Math.floor(uploadMaxFileSize / 1024 / 1024)}MB를 초과할 수 없습니다.`
        : error.message || '이미지 업로드 요청이 올바르지 않습니다.';

    return sendError(res, statusCode, message);
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
