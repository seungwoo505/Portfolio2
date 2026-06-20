const { logger, verboseDebug, buildErrorLog } = require('../common');
const Projects = require('../../../models/projects');
const CacheUtils = require('../../../utils/cache');
const { parsePagination } = require('../../../utils/pagination');
const { toOptionalBoolean } = require('../../../utils/filter-values');
const { parseSlugParam } = require('../../../utils/route-params');
const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../../utils/request-body');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const { normalizeProjectContentFields, normalizeUndefinedFields } = require('./payload');

module.exports = {
    authenticateToken,
    buildErrorLog,
    CacheUtils,
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    logActivity,
    logger,
    normalizeProjectContentFields,
    normalizeUndefinedFields,
    parsePagination,
    parseSlugParam,
    Projects,
    requirePermission,
    toOptionalBoolean,
    trimStringFields,
    verboseDebug
};
