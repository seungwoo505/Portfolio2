type QueryValue = string | number | null | undefined | QueryValue[];

type ClampIntegerOptions = {
    min?: number;
    max?: number;
    fallback?: number;
};

type PaginationQuery = {
    limit?: QueryValue;
    page?: QueryValue;
};

type PaginationOptions = {
    defaultLimit?: number;
    maxLimit?: number;
    maxPage?: number;
};

const firstQueryValue = (value: QueryValue): string | number | null | undefined => (
    Array.isArray(value) ? firstQueryValue(value[0]) : value
);

const clampInteger = (value: QueryValue, {
    min = 1,
    max = 100,
    fallback = 20
}: ClampIntegerOptions = {}): number => {
    const firstValue = firstQueryValue(value);
    let parsed: number;

    if (typeof firstValue === 'number') {
        parsed = firstValue;
    } else if (typeof firstValue === 'string') {
        const normalizedValue = firstValue.trim();
        if (!/^-?\d+$/.test(normalizedValue)) {
            return fallback;
        }
        parsed = Number(normalizedValue);
    } else {
        return fallback;
    }

    if (!Number.isSafeInteger(parsed)) {
        return fallback;
    }

    return Math.min(Math.max(parsed, min), max);
};

const parsePagination = (query: PaginationQuery = {}, options: PaginationOptions = {}) => {
    const {
        defaultLimit = 20,
        maxLimit = 100,
        maxPage = 10000
    } = options;
    const limit = clampInteger(query.limit, { min: 1, max: maxLimit, fallback: defaultLimit });
    const page = clampInteger(query.page, { min: 1, max: maxPage, fallback: 1 });

    return {
        limit,
        page,
        offset: (page - 1) * limit
    };
};

module.exports = {
    clampInteger,
    parsePagination
};

export {};
