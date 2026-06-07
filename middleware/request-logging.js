const logger = require("../log");

const requestLoggingMiddleware = (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        const isAdminApi = req.path.startsWith("/admin");
        const isDataModifying = ["POST", "PUT", "DELETE", "PATCH"].includes(req.method);
        const isAuthEndpoint = req.path.includes("/login") || req.path.includes("/logout");
        const isSlow = duration >= logger.getSlowRequestMs();

        if (isAuthEndpoint && req.path.includes("/login")) {
            logger.incrementCounter("loginAttempts");
        } else if (isAdminApi) {
            logger.incrementCounter("adminRequests");
        } else if (isDataModifying) {
            logger.incrementCounter("totalRequests");
        } else {
            logger.incrementCounter("publicRequests");
        }

        if (res.statusCode >= 400) {
            logger.incrementCounter("errors");
        }
        if (isSlow) {
            logger.incrementCounter("slowRequests");
        }

        logger.requestSummary(req, res, { durationMs: duration });
    });

    next();
};

module.exports = {
    requestLoggingMiddleware
};
