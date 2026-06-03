const {
    CONTACT_DUPLICATE_TTL_SECONDS,
    CONTACT_RECENT_IP_MAX,
    CONTACT_RECENT_WINDOW_HOURS
} = require('./config');
const { cacheKey, hashCachePart } = require('./cache');
const { getClientFingerprint } = require('./views');

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

const normalizeContactField = (value) => String(value ?? '').trim();

const validateContactLength = (field, value) => {
    const maxLength = CONTACT_FIELD_LIMITS[field];
    return !maxLength || value.length <= maxLength;
};

const getContactDuplicateKey = ({ email, message, req }) => cacheKey(
    'contact_duplicate',
    hashCachePart([
        email,
        message,
        getClientFingerprint(req)
    ].join('|'))
);

module.exports = {
    CONTACT_DUPLICATE_TTL_SECONDS,
    CONTACT_FIELD_LABELS,
    CONTACT_RECENT_IP_MAX,
    CONTACT_RECENT_WINDOW_HOURS,
    getContactDuplicateKey,
    normalizeContactField,
    validateContactLength
};
