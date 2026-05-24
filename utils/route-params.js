const { isValidSlug } = require('./slug');

const firstParamValue = (value) => (Array.isArray(value) ? value[0] : value);

const parsePositiveIntegerParam = (value) => {
    const rawValue = firstParamValue(value);

    if (typeof rawValue === 'number') {
        return Number.isSafeInteger(rawValue) && rawValue > 0 ? rawValue : null;
    }

    if (typeof rawValue !== 'string') {
        return null;
    }

    const normalizedValue = rawValue.trim();
    if (!/^[1-9]\d*$/.test(normalizedValue)) {
        return null;
    }

    const parsedValue = Number(normalizedValue);
    return Number.isSafeInteger(parsedValue) ? parsedValue : null;
};

const parseSlugParam = (value) => {
    const rawValue = firstParamValue(value);

    if (typeof rawValue !== 'string') {
        return null;
    }

    const slug = rawValue.trim();
    return isValidSlug(slug) ? slug : null;
};

module.exports = {
    parsePositiveIntegerParam,
    parseSlugParam
};
