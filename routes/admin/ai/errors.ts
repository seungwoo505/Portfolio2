import type { Request, Response } from 'express';

const { logger, buildErrorLog } = require('../common');

class AiValidationError extends Error {
    statusCode: number;

    constructor(message: string, statusCode = 400) {
        super(message);
        this.name = 'AiValidationError';
        this.statusCode = statusCode;
    }
}

type AiRouteTimeoutError = Error & {
    code?: string;
};

const isAiRouteTimeoutError = (error: unknown): error is AiRouteTimeoutError => (
    error instanceof Error && (error as AiRouteTimeoutError).code === 'AI_ROUTE_TIMEOUT'
);

const sendAiError = (res: Response, error: unknown, fallbackMessage: string) => {
    if (error instanceof AiValidationError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
    }

    if (isAiRouteTimeoutError(error)) {
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

const logAiError = (error: unknown, req: Request, message: string): void => {
    if (error instanceof AiValidationError) {
        return;
    }

    const payload = buildErrorLog(error, req);
    if (isAiRouteTimeoutError(error)) {
        logger.warn(message, payload);
        return;
    }

    logger.error(message, payload);
};

module.exports = {
    AiValidationError,
    isAiRouteTimeoutError,
    logAiError,
    sendAiError
};
