import type { Request, Response } from 'express';

const { requestMeta } = require('./request-meta');

type RequestLoggerOptions = {
    isVerboseEnabled: boolean;
    slowRequestMs: number;
};

const attachRequestLoggers = (logger: any, {
    isVerboseEnabled,
    slowRequestMs
}: RequestLoggerOptions): void => {
    logger.request = (req: Request, message = 'API 요청') => {
        if (!isVerboseEnabled) {
            return;
        }

        logger.debug(message, requestMeta(req, {
            body: req.method !== 'GET' ? logger.redact(req.body) : undefined,
            query: Object.keys(req.query || {}).length > 0 ? logger.redact(req.query) : undefined
        }));
    };

    logger.response = (req: Request, res: Response, message = 'API 응답') => {
        if (!isVerboseEnabled) {
            return;
        }

        logger.debug(message, requestMeta(req, {
            statusCode: res.statusCode,
            responseTime: res.get('X-Response-Time')
        }));
    };

    logger.requestSummary = (req: Request, res: Response, { durationMs }: { durationMs: number }) => {
        const statusCode = res.statusCode;
        const isAdminApi = req.path.startsWith('/admin');
        const isDataModifying = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
        const isAuthEndpoint = req.path.includes('/login') || req.path.includes('/logout');
        const isSlow = durationMs >= slowRequestMs;
        const shouldLog = isVerboseEnabled || isAdminApi || isDataModifying || isAuthEndpoint || statusCode >= 400 || isSlow;

        if (!shouldLog) {
            return;
        }

        const meta = requestMeta(req, {
            statusCode,
            durationMs
        });

        if (statusCode >= 500) {
            logger.error('request.error', meta);
        } else if (statusCode >= 400) {
            logger.warn('request.warn', meta);
        } else if (isSlow) {
            logger.warn('request.slow', meta);
        } else {
            logger.info('request.ok', meta);
        }
    };
};

module.exports = {
    attachRequestLoggers
};
