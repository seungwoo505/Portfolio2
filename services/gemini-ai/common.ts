const { GoogleGenerativeAI } = require('@google/generative-ai') as typeof import('@google/generative-ai');
const logger = require('../../log');

const isVerboseLogsEnabled = process.env.ENABLE_VERBOSE_LOGS === 'true';
const verboseDebug = (...args: unknown[]): void => {
    if (isVerboseLogsEnabled) {
        logger.debug(...args);
    }
};

module.exports = {
    GoogleGenerativeAI,
    logger,
    verboseDebug
};
