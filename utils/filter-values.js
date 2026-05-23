const firstQueryValue = (value) => {
    if (Array.isArray(value)) {
        return firstQueryValue(value[0]);
    }
    return value;
};

const toStringValue = (value, fallback = '') => {
    const firstValue = firstQueryValue(value);
    if (firstValue === undefined || firstValue === null) {
        return fallback;
    }
    if (typeof firstValue === 'string') {
        return firstValue;
    }
    if (typeof firstValue === 'number' || typeof firstValue === 'boolean') {
        return String(firstValue);
    }
    return fallback;
};

const toStringArray = (value) => {
    if (Array.isArray(value)) {
        return value.flatMap(toStringArray);
    }

    const stringValue = toStringValue(value).trim();
    return stringValue ? [stringValue] : [];
};

const toBooleanOrNull = (value) => {
    const firstValue = firstQueryValue(value);
    if (firstValue === true || firstValue === false) {
        return firstValue;
    }
    if (firstValue === undefined || firstValue === null || firstValue === '') {
        return null;
    }

    const stringValue = String(firstValue).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(stringValue)) {
        return true;
    }
    if (['false', '0', 'no', 'off'].includes(stringValue)) {
        return false;
    }

    return null;
};

const toChoice = (value, allowedValues, fallback) => {
    const normalized = toStringValue(value, fallback).trim().toLowerCase();
    return allowedValues.includes(normalized) ? normalized : fallback;
};

module.exports = {
    firstQueryValue,
    toBooleanOrNull,
    toChoice,
    toStringArray,
    toStringValue
};
