const { authenticateToken, requirePermission } = require('../../../middleware/auth');
const { getPlainBody } = require('../../../utils/request-body');
const { preprocessContent } = require('./content');
const { logAiError, sendAiError } = require('./errors');
const { geminiService, verboseDebug } = require('./service');
const { withTimeout } = require('./timeout');
const {
    normalizeIncludeKeywords,
    normalizeMaxKeywords,
    normalizeTechTags,
    validateContent
} = require('./validation');

module.exports = {
    authenticateToken,
    geminiService,
    getPlainBody,
    logAiError,
    normalizeIncludeKeywords,
    normalizeMaxKeywords,
    normalizeTechTags,
    preprocessContent,
    requirePermission,
    sendAiError,
    validateContent,
    verboseDebug,
    withTimeout
};
