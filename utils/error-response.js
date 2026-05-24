const getStatusCode = (error) => {
    const statusCode = Number(error?.status || error?.statusCode);
    return Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599
        ? statusCode
        : 500;
};

const isJsonParseError = (error) => (
    error?.type === 'entity.parse.failed'
    || (error instanceof SyntaxError && getStatusCode(error) === 400 && Object.prototype.hasOwnProperty.call(error, 'body'))
);

const getPublicErrorMessage = (error, statusCode, isDevelopment) => {
    if (isJsonParseError(error)) {
        return '요청 JSON 형식이 올바르지 않습니다.';
    }

    if (statusCode < 500) {
        return error?.message || '요청이 올바르지 않습니다.';
    }

    if (isDevelopment) {
        return error?.message || '서버 내부 오류가 발생했습니다.';
    }

    return '서버 내부 오류가 발생했습니다.';
};

const buildErrorResponse = (error, { nodeEnv = process.env.NODE_ENV } = {}) => {
    const statusCode = getStatusCode(error);
    const isDevelopment = nodeEnv === 'development';
    const body = {
        success: false,
        message: getPublicErrorMessage(error, statusCode, isDevelopment)
    };

    if (isDevelopment && error?.stack) {
        body.stack = error.stack;
    }

    return {
        statusCode,
        body,
        isClientError: statusCode < 500
    };
};

module.exports = {
    buildErrorResponse,
    getStatusCode,
    isJsonParseError
};
