const { redact } = require('./redaction');
const { attachDomainLoggers } = require('./domain');
const { attachRequestLoggers } = require('./request');
const { attachStats } = require('./stats');

const attachLoggerExtensions = (logger, { isVerboseEnabled, slowRequestMs }) => {
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
