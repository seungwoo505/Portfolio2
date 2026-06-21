import type { NextFunction, Request, Response } from 'express';

const logger = require("../log");
const { parseIntegerEnv } = require("../utils/env-number");
const { sendError } = require("../utils/api-response");

const REQUEST_TIMEOUT = parseIntegerEnv(process.env.REQUEST_TIMEOUT, {
    fallback: 2000,
    min: 1,
    clamp: false
});

const AI_REQUEST_TIMEOUT = parseIntegerEnv(process.env.AI_REQUEST_TIMEOUT, {
    fallback: 15000,
    min: 1,
    clamp: false
});

const getRequestTimeout = (req: Request): number => (
    req.originalUrl && req.originalUrl.startsWith("/admin/ai")
        ? AI_REQUEST_TIMEOUT
        : REQUEST_TIMEOUT
);

const requestTimeoutMiddleware = (req: Request, res: Response, next: NextFunction) => {
    let isTimedOut = false;
    const requestTimeout = getRequestTimeout(req);
    const timeoutId = setTimeout(() => {
        if (!isTimedOut && !res.headersSent) {
            isTimedOut = true;

            logger.warn("요청 타임아웃", {
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userAgent: req.headers["user-agent"],
                timeout: requestTimeout
            });

            sendError(res, 408, "요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.", {
                error: true,
                timeout: requestTimeout
            });
        }
    }, requestTimeout);

    const originalEnd = res.end;
    res.end = function endWithTimeoutCleanup(...args: unknown[]) {
        if (!isTimedOut) {
            clearTimeout(timeoutId);
        }
        return originalEnd.apply(this, args as Parameters<Response["end"]>);
    } as Response["end"];

    req.on("close", () => {
        if (!isTimedOut) {
            clearTimeout(timeoutId);
        }
    });

    next();
};

module.exports = {
    REQUEST_TIMEOUT,
    AI_REQUEST_TIMEOUT,
    requestTimeoutMiddleware
};
