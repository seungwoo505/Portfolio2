const logger = require('../../log');
const CacheUtils = require('../../utils/cache');
const redisCache = require('../../utils/redis-cache');
const { adminOnly } = require('../../middleware/auth');

const allowedCacheClearTypes = new Set(['memory', 'redis', 'all']);

const buildErrorLog = (error, req, extra = {}) => ({
    error: error?.message,
    path: req?.originalUrl,
    method: req?.method,
    stack: error?.stack,
    ...extra
});

module.exports = {
    CacheUtils,
    adminOnly,
    allowedCacheClearTypes,
    buildErrorLog,
    logger,
    redisCache
};
