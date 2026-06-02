const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../log');

const isVerboseLogsEnabled = process.env.ENABLE_VERBOSE_LOGS === 'true';
const verboseDebug = (...args) => {
    if (isVerboseLogsEnabled) {
        logger.debug(...args);
    }
};

module.exports = {
    GoogleGenerativeAI,
    logger,
    verboseDebug
};
