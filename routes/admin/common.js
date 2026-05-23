const logger = require('../../log');

const isVerboseLogsEnabled = process.env.ENABLE_VERBOSE_LOGS === 'true';

const verboseDebug = (...args) => {
    if (isVerboseLogsEnabled) {
        logger.debug(...args);
    }
};

const buildErrorLog = (error, req, extra = {}) => ({
    error: error?.message,
    path: req?.originalUrl,
    method: req?.method,
    stack: error?.stack,
    ...extra
});

module.exports = {
    logger,
    verboseDebug,
    buildErrorLog
};
