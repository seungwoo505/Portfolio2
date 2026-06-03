const crypto = require('crypto');

const CacheUtils = require('../../../utils/cache');
const { PUBLIC_CACHE_TTL_SECONDS } = require('./config');

const cacheKey = (prefix, ...parts) => CacheUtils.generateKey(prefix, 'public', ...parts);

const cached = async (key, loader, ttl = PUBLIC_CACHE_TTL_SECONDS) => (
    CacheUtils.cacheApiResponse(key, loader, ttl)
);

const hashCachePart = (value) => (
    crypto.createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 16)
);

const stableStringify = (value) => {
    if (!value || typeof value !== 'object') {
        return String(value ?? '');
    }

    return JSON.stringify(
        Object.keys(value)
            .sort()
            .reduce((acc, key) => {
                const fieldValue = value[key];
                if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                    acc[key] = fieldValue;
                }
                return acc;
            }, {})
    );
};

module.exports = {
    CacheUtils,
    cacheKey,
    cached,
    hashCachePart,
    stableStringify
};
