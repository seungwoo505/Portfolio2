const logger = require('../../../log');
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
    return res.json({
        success: true,
        data,
        ...extra
    });
};

const notFound = (res, message = '요청한 공개 리소스를 찾을 수 없습니다.') => (
    res.status(404).json({
        success: false,
        message
    })
);

const badRequest = (res, message) => (
    res.status(400).json({
        success: false,
        message
    })
);

const fail = (res, error, req, message) => {
    logger.error(message, {
        requestId: req.requestId,
        path: req.originalUrl,
        method: req.method,
        error: error.message,
        stack: error.stack
    });

    return res.status(500).json({
        success: false,
        message
    });
};

module.exports = {
    badRequest,
    fail,
    notFound,
    ok
};
