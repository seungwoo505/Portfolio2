const firstValue = (value) => (Array.isArray(value) ? value[0] : value);

const parseIntegerEnv = (value, {
    fallback,
    min = 1,
    max = Number.MAX_SAFE_INTEGER
} = {}) => {
    const parsed = Number.parseInt(firstValue(value), 10);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(Math.max(parsed, min), max);
};

module.exports = {
    parseIntegerEnv
};
