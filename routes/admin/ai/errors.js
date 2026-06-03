const { logger, buildErrorLog } = require('../common');

class AiValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'AiValidationError';
        this.statusCode = statusCode;
    }
}

const sendAiError = (res, error, fallbackMessage) => {
    if (error instanceof AiValidationError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === 'AI_ROUTE_TIMEOUT') {
        return res.status(504).json({
            success: false,
            message: 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
        });
    }

    return res.status(500).json({
        success: false,
        message: fallbackMessage
    });
};

const logAiError = (error, req, message) => {
    if (error instanceof AiValidationError) {
        return;
    }

    const payload = buildErrorLog(error, req);
    if (error.code === 'AI_ROUTE_TIMEOUT') {
        logger.warn(message, payload);
        return;
    }

    logger.error(message, payload);
};

module.exports = {
    AiValidationError,
    logAiError,
    sendAiError
};
