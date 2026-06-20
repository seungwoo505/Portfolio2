const logger = require("../log");
const { buildErrorResponse } = require("../utils/error-response");
const { sendJson, sendNotFound } = require("../utils/api-response");

const notFoundHandler = (req, res) => {
    sendNotFound(res, "요청하신 리소스를 찾을 수 없습니다.", {
        path: req.originalUrl
    });
};

const errorHandler = (error, req, res, next) => {
    const errorResponse = buildErrorResponse(error, {
        nodeEnv: process.env.NODE_ENV
    });
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        body: req.method !== "GET" ? logger.redact(req.body) : undefined,
        statusCode: errorResponse.statusCode
    };

    if (errorResponse.isClientError) {
        logger.warn("클라이언트 오류", errorInfo);
    } else {
        logger.error("서버 오류", errorInfo);
    }

    sendJson(res, errorResponse.statusCode, errorResponse.body);
};

module.exports = {
    notFoundHandler,
    errorHandler
};
