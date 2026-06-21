import type { Request } from 'express';

const { CacheUtils, cacheKey, hashCachePart } = require('./cache');
const { PUBLIC_VIEW_DEDUPE_TTL_SECONDS } = require('./config');

type IncrementViewOptions = {
    resourceType: string;
    slug: string;
    req: Request;
    increment: () => Promise<unknown> | unknown;
    invalidate: () => void;
};

const getClientFingerprint = (req: Request): string => hashCachePart([
    req.ip,
    req.headers['user-agent'] || ''
].join('|'));

const getViewDedupeKey = (resourceType: string, slug: string, req: Request): string => cacheKey(
    'view_dedupe',
    resourceType,
    slug,
    getClientFingerprint(req)
);

const incrementViewOnce = async ({ resourceType, slug, req, increment, invalidate }: IncrementViewOptions): Promise<boolean> => {
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
