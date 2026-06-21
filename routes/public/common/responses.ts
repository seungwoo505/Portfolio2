import type { Request, Response } from 'express';

const logger = require('../../../log');
const {
    sendBadRequest,
    sendNotFound,
    sendServerError,
    sendSuccess
} = require('../../../utils/api-response');
const {
    PUBLIC_HTTP_MAX_AGE_SECONDS,
    PUBLIC_HTTP_STALE_SECONDS
} = require('./config');

const setPublicCacheHeaders = (res: Response): void => {
    res.setHeader(
        'Cache-Control',
        `public, max-age=${PUBLIC_HTTP_MAX_AGE_SECONDS}, stale-while-revalidate=${PUBLIC_HTTP_STALE_SECONDS}`
    );
};

const ok = (res: Response, data: unknown, extra: Record<string, unknown> = {}) => {
    setPublicCacheHeaders(res);
    return sendSuccess(res, data, extra);
};

const notFound = (res: Response, message = '요청한 공개 리소스를 찾을 수 없습니다.') => (
    sendNotFound(res, message)
);

const badRequest = (res: Response, message: string) => (
    sendBadRequest(res, message)
);

const fail = (res: Response, error: unknown, req: Request, message: string) => {
    logger.error(message, {
        requestId: req.requestId,
        path: req.originalUrl,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
    });

    return sendServerError(res, message);
};

module.exports = {
    badRequest,
    fail,
    notFound,
    ok
};
