const crypto = require('crypto');

const CacheUtils = require('../../../utils/cache');
const { PUBLIC_CACHE_TTL_SECONDS } = require('./config');

type CachePart = string | number | boolean | null | undefined;
type CacheLoader<T> = () => T | Promise<T>;
type StableObject = Record<string, unknown>;

const cacheKey = (prefix: string, ...parts: CachePart[]): string => CacheUtils.generateKey(prefix, 'public', ...parts);

const cached = async <T>(key: string, loader: CacheLoader<T>, ttl = PUBLIC_CACHE_TTL_SECONDS): Promise<T> => (
    CacheUtils.cacheApiResponse(key, loader, ttl)
);

const hashCachePart = (value: unknown): string => (
    crypto.createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 16)
);

const stableStringify = (value: unknown): string => {
    if (!value || typeof value !== 'object') {
        return String(value ?? '');
    }

    const objectValue = value as StableObject;

    return JSON.stringify(
        Object.keys(objectValue)
            .sort()
            .reduce((acc, key) => {
                const fieldValue = objectValue[key];
                if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                    acc[key] = fieldValue;
                }
                return acc;
            }, {} as StableObject)
    );
};

module.exports = {
    CacheUtils,
    cacheKey,
    cached,
    hashCachePart,
    stableStringify
};
