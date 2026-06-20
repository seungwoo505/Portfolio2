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

const setPublicCacheHeaders = (res) => {
    res.setHeader(
        'Cache-Control',
        `public, max-age=${PUBLIC_HTTP_MAX_AGE_SECONDS}, stale-while-revalidate=${PUBLIC_HTTP_STALE_SECONDS}`
    );
};

const ok = (res, data, extra = {}) => {
    setPublicCacheHeaders(res);
    return sendSuccess(res, data, extra);
};

const notFound = (res, message = '요청한 공개 리소스를 찾을 수 없습니다.') => (
    sendNotFound(res, message)
);

const badRequest = (res, message) => (
    sendBadRequest(res, message)
);

const fail = (res, error, req, message) => {
    logger.error(message, {
        requestId: req.requestId,
        path: req.originalUrl,
        method: req.method,
        error: error.message,
        stack: error.stack
    });

    return sendServerError(res, message);
};

module.exports = {
    badRequest,
    fail,
    notFound,
    ok
};
