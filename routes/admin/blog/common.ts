const { logger, buildErrorLog } = require('../common');
const BlogPosts = require('../../../models/blog-posts');
const CacheUtils = require('../../../utils/cache');
const { parsePagination } = require('../../../utils/pagination');
const { toBooleanOrNull } = require('../../../utils/filter-values');
const { parseSlugParam } = require('../../../utils/route-params');
const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../../utils/request-body');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');

module.exports = {
    authenticateToken,
    BlogPosts,
    buildErrorLog,
    CacheUtils,
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    logActivity,
    logger,
    parsePagination,
    parseSlugParam,
    requirePermission,
    toBooleanOrNull,
    trimStringFields
};

export {};
