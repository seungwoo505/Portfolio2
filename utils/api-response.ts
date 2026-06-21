import type { NextFunction, Request, Response } from 'express';

type ApiBody = Record<string, unknown>;

type SuccessOptions = ApiBody & {
    message?: unknown;
    statusCode?: number;
};

type ErrorOptions = ApiBody & {
    error?: unknown;
};

const isPlainObject = (value: unknown): value is ApiBody => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
);

const hasText = (value: unknown): value is string => (
    typeof value === 'string' && value.trim().length > 0
);

const normalizeApiResponseBody = (body: unknown): unknown => {
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

const buildSuccessBody = (data: unknown, { message, ...extra }: SuccessOptions = {}): ApiBody => {
    const body: ApiBody = {
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

const buildErrorBody = (message: string, { error, ...extra }: ErrorOptions = {}): ApiBody => {
    const body: ApiBody = {
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

const sendJson = (res: Response, statusCode: number, body: unknown) => (
    res.status(statusCode).json(normalizeApiResponseBody(body))
);

const sendSuccess = (res: Response, data: unknown, options: SuccessOptions = {}) => {
    const { statusCode = 200, ...bodyOptions } = options;
    return sendJson(res, statusCode, buildSuccessBody(data, bodyOptions));
};

const sendCreated = (res: Response, data: unknown, options: SuccessOptions = {}) => (
    sendSuccess(res, data, {
        ...options,
        statusCode: 201
    })
);

const sendError = (res: Response, statusCode: number, message: string, options: ErrorOptions = {}) => (
    sendJson(res, statusCode, buildErrorBody(message, options))
);

const sendBadRequest = (res: Response, message: string, options: ErrorOptions = {}) => (
    sendError(res, 400, message, options)
);

const sendUnauthorized = (res: Response, message: string, options: ErrorOptions = {}) => (
    sendError(res, 401, message, options)
);

const sendForbidden = (res: Response, message: string, options: ErrorOptions = {}) => (
    sendError(res, 403, message, options)
);

const sendNotFound = (res: Response, message: string, options: ErrorOptions = {}) => (
    sendError(res, 404, message, options)
);

const sendConflict = (res: Response, message: string, options: ErrorOptions = {}) => (
    sendError(res, 409, message, options)
);

const sendTooManyRequests = (res: Response, message: string, options: ErrorOptions = {}) => (
    sendError(res, 429, message, options)
);

const sendServerError = (res: Response, message: string, options: ErrorOptions = {}) => (
    sendError(res, 500, message, options)
);

const apiResponseNormalizer = (_req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json;

    res.json = function jsonWithNormalizedApiBody(body: unknown) {
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
