const { parseIntegerEnv } = require('../../../utils/env-number');

const AI_CONTENT_MAX_LENGTH = parseIntegerEnv(process.env.AI_CONTENT_MAX_LENGTH, {
    fallback: 20000,
    min: 1,
    clamp: false
});
const AI_TECH_TAGS_MAX = parseIntegerEnv(process.env.AI_TECH_TAGS_MAX, {
    fallback: 30,
    min: 1,
    clamp: false
});
const AI_TECH_TAG_MAX_LENGTH = parseIntegerEnv(process.env.AI_TECH_TAG_MAX_LENGTH, {
    fallback: 80,
    min: 1,
    clamp: false
});
const AI_MAX_KEYWORDS = parseIntegerEnv(process.env.AI_MAX_KEYWORDS, {
    fallback: 20,
    min: 1,
    clamp: false
});
const AI_REQUEST_TIMEOUT = parseIntegerEnv(process.env.AI_REQUEST_TIMEOUT, {
    fallback: 15000,
    min: 1,
    clamp: false
});
const AI_ROUTE_TIMEOUT = parseIntegerEnv(process.env.AI_ROUTE_TIMEOUT, {
    fallback: Math.max(1000, AI_REQUEST_TIMEOUT - 500),
    min: 1,
    clamp: false
});

module.exports = {
    AI_CONTENT_MAX_LENGTH,
    AI_MAX_KEYWORDS,
    AI_REQUEST_TIMEOUT,
    AI_ROUTE_TIMEOUT,
    AI_TECH_TAG_MAX_LENGTH,
    AI_TECH_TAGS_MAX
};
