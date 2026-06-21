const { redact } = require('./redaction');
const { attachDomainLoggers } = require('./domain');
const { attachRequestLoggers } = require('./request');
const { attachStats } = require('./stats');

type LoggerRuntimeOptions = {
    isVerboseEnabled: boolean;
    slowRequestMs: number;
};

const attachLoggerExtensions = (logger: any, {
    isVerboseEnabled,
    slowRequestMs
}: LoggerRuntimeOptions): void => {
    logger.redact = redact;
    logger.isVerboseEnabled = () => isVerboseEnabled;
    logger.getSlowRequestMs = () => slowRequestMs;

    attachRequestLoggers(logger, { isVerboseEnabled, slowRequestMs });
    attachDomainLoggers(logger, isVerboseEnabled);
    attachStats(logger, isVerboseEnabled);
};

module.exports = {
    attachLoggerExtensions
};

export {};
