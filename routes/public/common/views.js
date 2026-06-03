const { CacheUtils, cacheKey, hashCachePart } = require('./cache');
const { PUBLIC_VIEW_DEDUPE_TTL_SECONDS } = require('./config');

const getClientFingerprint = (req) => hashCachePart([
    req.ip,
    req.headers['user-agent'] || ''
].join('|'));

const getViewDedupeKey = (resourceType, slug, req) => cacheKey(
    'view_dedupe',
    resourceType,
    slug,
    getClientFingerprint(req)
);

const incrementViewOnce = async ({ resourceType, slug, req, increment, invalidate }) => {
    const dedupeKey = getViewDedupeKey(resourceType, slug, req);
    if (!CacheUtils.claim(dedupeKey, PUBLIC_VIEW_DEDUPE_TTL_SECONDS)) {
        return false;
    }

    try {
        await increment();
        invalidate();
        return true;
    } catch (error) {
        CacheUtils.release(dedupeKey);
        throw error;
    }
};

module.exports = {
    getClientFingerprint,
    incrementViewOnce
};
