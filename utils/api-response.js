const isPlainObject = (value) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
);

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeApiResponseBody = (body) => {
    if (!isPlainObject(body) || body.success !== false || hasText(body.message)) {
        return body;
    }

    if (hasText(body.error)) {
        return {
            ...body,
            message: body.error
        };
    }

    return body;
};

const buildSuccessBody = (data, { message, ...extra } = {}) => {
    const body = {
        success: true
    };

    if (hasText(message)) {
        body.message = message;
    }

    if (data !== undefined) {
        body.data = data;
    }

    return {
        ...body,
        ...extra
    };
};

const buildErrorBody = (message, { error, ...extra } = {}) => {
    const body = {
        success: false,
        message
    };

    if (error !== undefined) {
        body.error = error === true ? message : error;
    }

    return {
        ...body,
        ...extra
    };
};

const sendJson = (res, statusCode, body) => (
    res.status(statusCode).json(normalizeApiResponseBody(body))
);

const sendSuccess = (res, data, options = {}) => {
    const { statusCode = 200, ...bodyOptions } = options;
    return sendJson(res, statusCode, buildSuccessBody(data, bodyOptions));
};

const sendCreated = (res, data, options = {}) => (
    sendSuccess(res, data, {
        ...options,
        statusCode: 201
    })
);

const sendError = (res, statusCode, message, options = {}) => (
    sendJson(res, statusCode, buildErrorBody(message, options))
);

const sendBadRequest = (res, message, options = {}) => (
    sendError(res, 400, message, options)
);

const sendUnauthorized = (res, message, options = {}) => (
    sendError(res, 401, message, options)
);

const sendForbidden = (res, message, options = {}) => (
    sendError(res, 403, message, options)
);

const sendNotFound = (res, message, options = {}) => (
    sendError(res, 404, message, options)
);

const sendConflict = (res, message, options = {}) => (
    sendError(res, 409, message, options)
);

const sendTooManyRequests = (res, message, options = {}) => (
    sendError(res, 429, message, options)
);

const sendServerError = (res, message, options = {}) => (
    sendError(res, 500, message, options)
);

const apiResponseNormalizer = (_req, res, next) => {
    const originalJson = res.json;

    res.json = function jsonWithNormalizedApiBody(body) {
        return originalJson.call(this, normalizeApiResponseBody(body));
    };

    next();
};

module.exports = {
    apiResponseNormalizer,
    buildErrorBody,
    buildSuccessBody,
    normalizeApiResponseBody,
    sendBadRequest,
    sendConflict,
    sendCreated,
    sendError,
    sendForbidden,
    sendJson,
    sendNotFound,
    sendServerError,
    sendSuccess,
    sendTooManyRequests,
    sendUnauthorized
};
