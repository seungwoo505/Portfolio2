import type { Request } from 'express';

const logger = require('../../log');
const CacheUtils = require('../../utils/cache');
const redisCache = require('../../utils/redis-cache');
const { adminOnly } = require('../../middleware/auth');

const allowedCacheClearTypes = new Set(['memory', 'redis', 'all']);

const buildErrorLog = (error: unknown, req?: Request, extra: Record<string, unknown> = {}) => ({
    error: error instanceof Error ? error.message : String(error),
    path: req?.originalUrl,
    method: req?.method,
    stack: error instanceof Error ? error.stack : undefined,
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
