const { isValidSlug } = require('./slug');

type RouteParamValue = string | number | null | undefined | RouteParamValue[];

const firstParamValue = (value: RouteParamValue): string | number | null | undefined => (
    Array.isArray(value) ? firstParamValue(value[0]) : value
);

const parsePositiveIntegerParam = (value: RouteParamValue): number | null => {
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

const parseSlugParam = (value: RouteParamValue): string | null => {
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

export {};
