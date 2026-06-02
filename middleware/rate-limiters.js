const rateLimit = require("express-rate-limit");
const logger = require("../log");
const { getRetryAfterSeconds } = require("../utils/rate-limit");
const { parseIntegerEnv } = require("../utils/env-number");

const CONTACT_RATE_LIMIT_MAX = parseIntegerEnv(process.env.CONTACT_RATE_LIMIT_MAX, {
    fallback: 5,
    max: 100
});

const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 300,
    message: {
        success: false,
        error: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        logger.warn("Rate limit exceeded", {
            ip: req.ip,
            url: req.originalUrl,
            method: req.method
        });
        res.status(429).json({
            success: false,
            error: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
            retryAfter: getRetryAfterSeconds(req.rateLimit, 60)
        });
    }
});

const adminLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        error: "관리자 API 요청이 너무 많습니다. 1분 후 다시 시도해주세요.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn("Admin rate limit exceeded", {
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            url: req.originalUrl,
            method: req.method
        });
        res.status(429).json({
            success: false,
            error: "관리자 API 요청이 너무 많습니다. 1분 후 다시 시도해주세요.",
            retryAfter: getRetryAfterSeconds(req.rateLimit, 60)
        });
    }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn("Login rate limit exceeded", {
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            url: req.originalUrl
        });
        res.status(429).json({
            success: false,
            error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
            retryAfter: getRetryAfterSeconds(req.rateLimit, 15 * 60)
        });
    }
});

const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: CONTACT_RATE_LIMIT_MAX,
    message: {
        success: false,
        error: "문의 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn("Contact rate limit exceeded", {
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            url: req.originalUrl,
            method: req.method
        });
        res.status(429).json({
            success: false,
            error: "문의 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
            retryAfter: getRetryAfterSeconds(req.rateLimit, 15 * 60)
        });
    }
});

module.exports = {
    generalLimiter,
    adminLimiter,
    loginLimiter,
    contactLimiter
};
