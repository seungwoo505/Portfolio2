const { clampInteger } = require('../../../utils/pagination');

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

module.exports = {
    CONTACT_DUPLICATE_TTL_SECONDS,
    CONTACT_RECENT_IP_MAX,
    CONTACT_RECENT_WINDOW_HOURS,
    PUBLIC_CACHE_TTL_SECONDS,
    PUBLIC_HTTP_MAX_AGE_SECONDS,
    PUBLIC_HTTP_STALE_SECONDS,
    PUBLIC_VIEW_DEDUPE_TTL_SECONDS
};
