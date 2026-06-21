const winston = require('winston');
const { createLogFormat } = require('./format');
const { attachLoggerExtensions } = require('./extensions');
const {
    isVerboseEnabled,
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
    ]
});

attachLoggerExtensions(logger, {
    isVerboseEnabled,
    slowRequestMs
});

module.exports = logger;

export {};
