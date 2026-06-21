type FilterValue = string | number | boolean | null | undefined | FilterValue[];

type OptionalBooleanResult = {
    isValid: boolean;
    value: boolean | null;
};

const firstQueryValue = (value: FilterValue): string | number | boolean | null | undefined => {
    if (Array.isArray(value)) {
        return firstQueryValue(value[0]);
    }
    return value;
};

const toStringValue = (value: FilterValue, fallback = ''): string => {
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

const toStringArray = (value: FilterValue): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap(toStringArray);
    }

    const stringValue = toStringValue(value).trim();
    return stringValue ? [stringValue] : [];
};

const toCsvStringArray = (value: FilterValue): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap(toCsvStringArray);
    }

    const stringValue = toStringValue(value).trim();
    if (!stringValue) {
        return [];
    }

    return stringValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
};

const toBooleanOrNull = (value: FilterValue): boolean | null => {
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

const toOptionalBoolean = (value: FilterValue): OptionalBooleanResult => {
    const firstValue = firstQueryValue(value);
    if (firstValue === undefined || firstValue === null || firstValue === '') {
        return {
            isValid: true,
            value: null
        };
    }

    const booleanValue = toBooleanOrNull(firstValue);
    return {
        isValid: booleanValue !== null,
        value: booleanValue
    };
};

const toChoice = (value: FilterValue, allowedValues: string[], fallback: string): string => {
    const normalized = toStringValue(value, fallback).trim().toLowerCase();
    return allowedValues.includes(normalized) ? normalized : fallback;
};

module.exports = {
    firstQueryValue,
    toBooleanOrNull,
    toOptionalBoolean,
    toChoice,
    toCsvStringArray,
    toStringArray,
    toStringValue
};

export {};
