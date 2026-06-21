type IntegerInput = unknown;

type ParseIntegerEnvOptions = {
    fallback?: number;
    min?: number;
    max?: number;
    clamp?: boolean;
};

const firstValue = (value: IntegerInput): unknown => (Array.isArray(value) ? value[0] : value);

const parseStrictInteger = (value: IntegerInput): number | null => {
    const rawValue = firstValue(value);

    if (typeof rawValue === 'number') {
        return Number.isSafeInteger(rawValue) ? rawValue : null;
    }

    if (typeof rawValue !== 'string') {
        return null;
    }

    const normalizedValue = rawValue.trim();
    if (!/^-?\d+$/.test(normalizedValue)) {
        return null;
    }

    const parsed = Number(normalizedValue);
    return Number.isSafeInteger(parsed) ? parsed : null;
};

const parseIntegerEnv = (value: IntegerInput, {
    fallback,
    min = 1,
    max = Number.MAX_SAFE_INTEGER,
    clamp = true
}: ParseIntegerEnvOptions = {}): number | undefined => {
    const parsed = parseStrictInteger(value);

    if (parsed === null) {
        return fallback;
    }

    if (!clamp && (parsed < min || parsed > max)) {
        return fallback;
    }

    return Math.min(Math.max(parsed, min), max);
};

module.exports = {
    parseIntegerEnv,
    parseStrictInteger
};

export {};
