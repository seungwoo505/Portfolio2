const firstQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

const clampInteger = (value, { min = 1, max = 100, fallback = 20 } = {}) => {
    const parsed = Number.parseInt(firstQueryValue(value), 10);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(Math.max(parsed, min), max);
};

const parsePagination = (query = {}, options = {}) => {
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
