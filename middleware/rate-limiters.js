const rateLimit = require("express-rate-limit");
const logger = require("../log");
const { getRetryAfterSeconds } = require("../utils/rate-limit");
const { parseIntegerEnv } = require("../utils/env-number");
const { sendTooManyRequests } = require("../utils/api-response");

const CONTACT_RATE_LIMIT_MAX = parseIntegerEnv(process.env.CONTACT_RATE_LIMIT_MAX, {
    fallback: 5,
    max: 100
});
const PUBLIC_RATE_LIMIT_MAX = parseIntegerEnv(process.env.PUBLIC_RATE_LIMIT_MAX, {
    fallback: 600,
    max: 5000
});
const AI_RATE_LIMIT_MAX = parseIntegerEnv(process.env.AI_RATE_LIMIT_MAX, {
    fallback: 10,
    max: 100
});
const MONITORING_RATE_LIMIT_MAX = parseIntegerEnv(process.env.MONITORING_RATE_LIMIT_MAX, {
    fallback: 60,
    max: 300
});

const buildRateLimitLogMeta = (req, { includeMethod = true, includeUserAgent = false } = {}) => {
    const meta = {
        ip: req.ip,
        url: req.originalUrl
    };

    if (includeMethod) {
        meta.method = req.method;
    }

    if (includeUserAgent) {
        meta.userAgent = req.headers["user-agent"];
    }

    return meta;
};

const createRateLimitHandler = ({
    error,
    includeMethod,
    includeUserAgent,
    logMessage,
    retryAfterSeconds
}) => (req, res) => {
    logger.warn(logMessage, buildRateLimitLogMeta(req, {
        includeMethod,
        includeUserAgent
    }));

    sendTooManyRequests(res, error, {
        error,
        retryAfter: getRetryAfterSeconds(req.rateLimit, retryAfterSeconds)
    });
};

const createServerRateLimiter = ({
    error,
    includeMethod = true,
    includeUserAgent = false,
    logMessage,
    max,
    retryAfterSeconds,
    skipSuccessfulRequests = false,
    windowMs
}) => rateLimit({
    windowMs,
    max,
    message: {
        success: false,
        error
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: createRateLimitHandler({
        error,
        includeMethod,
        includeUserAgent,
        logMessage,
        retryAfterSeconds
    })
});

const generalLimiter = createServerRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: 300,
    error: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
    logMessage: "Rate limit exceeded",
    retryAfterSeconds: 60,
    skipSuccessfulRequests: true
});

const publicReadLimiter = createServerRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: PUBLIC_RATE_LIMIT_MAX,
    error: "공개 API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    logMessage: "Public API rate limit exceeded",
    retryAfterSeconds: 60
});

const adminLimiter = createServerRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: 100,
    error: "관리자 API 요청이 너무 많습니다. 1분 후 다시 시도해주세요.",
    includeUserAgent: true,
    logMessage: "Admin rate limit exceeded",
    retryAfterSeconds: 60
});

const aiLimiter = createServerRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: AI_RATE_LIMIT_MAX,
    error: "AI API 요청이 너무 많습니다. 1분 후 다시 시도해주세요.",
    includeUserAgent: true,
    logMessage: "AI rate limit exceeded",
    retryAfterSeconds: 60
});

const monitoringLimiter = createServerRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: MONITORING_RATE_LIMIT_MAX,
    error: "모니터링 API 요청이 너무 많습니다. 1분 후 다시 시도해주세요.",
    includeUserAgent: true,
    logMessage: "Monitoring rate limit exceeded",
    retryAfterSeconds: 60
});

const loginLimiter = createServerRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
    includeMethod: false,
    includeUserAgent: true,
    logMessage: "Login rate limit exceeded",
    retryAfterSeconds: 15 * 60,
    skipSuccessfulRequests: true
});

const contactLimiter = createServerRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: CONTACT_RATE_LIMIT_MAX,
    error: "문의 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    includeUserAgent: true,
    logMessage: "Contact rate limit exceeded",
    retryAfterSeconds: 15 * 60
});

module.exports = {
    generalLimiter,
    publicReadLimiter,
    adminLimiter,
    aiLimiter,
    monitoringLimiter,
    loginLimiter,
    contactLimiter
};
