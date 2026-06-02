const crypto = require('crypto');
const logger = require('../../log');
const CacheUtils = require('../../utils/cache');
const { clampInteger, parsePagination } = require('../../utils/pagination');
const { toOptionalBoolean, toCsvStringArray, toStringValue } = require('../../utils/filter-values');

const PUBLIC_CACHE_TTL_SECONDS = clampInteger(process.env.PUBLIC_CACHE_TTL_SECONDS, {
    fallback: 300,
    max: 86400
});
const PUBLIC_HTTP_MAX_AGE_SECONDS = clampInteger(process.env.PUBLIC_HTTP_MAX_AGE_SECONDS, {
    fallback: 60,
    max: 86400
});
const PUBLIC_HTTP_STALE_SECONDS = clampInteger(process.env.PUBLIC_HTTP_STALE_SECONDS, {
    fallback: 300,
    max: 604800
});
const PUBLIC_VIEW_DEDUPE_TTL_SECONDS = clampInteger(process.env.PUBLIC_VIEW_DEDUPE_TTL_SECONDS, {
    fallback: 300,
    max: 86400
});

const CONTACT_FIELD_LIMITS = {
    name: 120,
    email: 255,
    subject: 255,
    message: 5000
};
const CONTACT_FIELD_LABELS = {
    name: '이름',
    email: '이메일',
    subject: '제목',
    message: '메시지'
};
const CONTACT_RECENT_WINDOW_HOURS = clampInteger(process.env.CONTACT_RECENT_WINDOW_HOURS, {
    fallback: 1,
    max: 24
});
const CONTACT_RECENT_IP_MAX = clampInteger(process.env.CONTACT_RECENT_IP_MAX, {
    fallback: 3,
    max: 50
});
const CONTACT_DUPLICATE_TTL_SECONDS = clampInteger(process.env.CONTACT_DUPLICATE_TTL_SECONDS, {
    fallback: 300,
    max: 86400
});

const normalizeContactField = (value) => String(value ?? '').trim();

const validateContactLength = (field, value) => {
    const maxLength = CONTACT_FIELD_LIMITS[field];
    return !maxLength || value.length <= maxLength;
};

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

const setPublicCacheHeaders = (res) => {
    res.setHeader(
        'Cache-Control',
        `public, max-age=${PUBLIC_HTTP_MAX_AGE_SECONDS}, stale-while-revalidate=${PUBLIC_HTTP_STALE_SECONDS}`
    );
};

const ok = (res, data, extra = {}) => {
    setPublicCacheHeaders(res);
    return res.json({
        success: true,
        data,
        ...extra
    });
};

const notFound = (res, message = '요청한 공개 리소스를 찾을 수 없습니다.') => (
    res.status(404).json({
        success: false,
        message
    })
);

const badRequest = (res, message) => (
    res.status(400).json({
        success: false,
        message
    })
);

const fail = (res, error, req, message) => {
    logger.error(message, {
        requestId: req.requestId,
        path: req.originalUrl,
        method: req.method,
        error: error.message,
        stack: error.stack
    });

    return res.status(500).json({
        success: false,
        message
    });
};

const cacheKey = (prefix, ...parts) => CacheUtils.generateKey(prefix, 'public', ...parts);

const cached = async (key, loader, ttl = PUBLIC_CACHE_TTL_SECONDS) => (
    CacheUtils.cacheApiResponse(key, loader, ttl)
);

const hashCachePart = (value) => (
    crypto.createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 16)
);

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

const getContactDuplicateKey = ({ email, message, req }) => cacheKey(
    'contact_duplicate',
    hashCachePart([
        email,
        message,
        getClientFingerprint(req)
    ].join('|'))
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

const buildProjectFilters = (query) => {
    const featured = toOptionalBoolean(query.featured);
    if (!featured.isValid) {
        return {
            error: 'featured 값은 boolean이어야 합니다.'
        };
    }

    const { limit, page, offset } = parsePagination(query, {
        defaultLimit: 10,
        maxLimit: 50
    });

    return {
        limit,
        page,
        offset,
        search: toStringValue(query.search),
        tags: toCsvStringArray(query.tags),
        skills: toCsvStringArray(query.skills),
        featured: featured.value,
        status: 'published',
        sort: toStringValue(query.sort, 'display_order'),
        order: toStringValue(query.order, 'asc'),
        published_only: true
    };
};

const buildPostFilters = (query) => {
    const featured = toOptionalBoolean(query.featured);
    if (!featured.isValid) {
        return {
            error: 'featured 값은 boolean이어야 합니다.'
        };
    }

    const { limit, page, offset } = parsePagination(query, {
        defaultLimit: 10,
        maxLimit: 50
    });

    return {
        limit,
        page,
        offset,
        search: toStringValue(query.search),
        tags: toCsvStringArray(query.tags),
        featured: featured.value,
        status: 'published',
        sort: toStringValue(query.sort, 'published_at'),
        order: toStringValue(query.order, 'desc'),
        published_only: true
    };
};

module.exports = {
    CacheUtils,
    CONTACT_DUPLICATE_TTL_SECONDS,
    CONTACT_FIELD_LABELS,
    CONTACT_RECENT_IP_MAX,
    CONTACT_RECENT_WINDOW_HOURS,
    badRequest,
    buildPostFilters,
    buildProjectFilters,
    cacheKey,
    cached,
    fail,
    getContactDuplicateKey,
    incrementViewOnce,
    normalizeContactField,
    notFound,
    ok,
    parsePagination,
    stableStringify,
    toOptionalBoolean,
    toStringValue,
    validateContactLength
};
