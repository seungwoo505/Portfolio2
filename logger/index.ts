const winston = require('winston');
const { createLogFormat } = require('./format');
const { attachLoggerExtensions } = require('./extensions');
const {
    isVerboseEnabled,
    reportLoggerError,
    slowRequestMs,
    transport
} = require('./runtime');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: createLogFormat(),
    transports: [
        transport,
        new winston.transports.Console({
            format: createLogFormat()
        })
    ].filter(Boolean)
});

// Winston은 transport 오류를 logger에도 재방출한다.
logger.on('error', reportLoggerError);

attachLoggerExtensions(logger, {
    isVerboseEnabled,
    slowRequestMs
});

module.exports = logger;

export {};
