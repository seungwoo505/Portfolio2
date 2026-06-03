const normalizeQueryForLog = (query) => query.replace(/\s+/g, ' ').trim();

const buildQueryLogMeta = (query, params = [], extra = {}) => ({
    query: normalizeQueryForLog(query),
    paramCount: Array.isArray(params) ? params.length : 0,
    ...extra
});

module.exports = {
    buildQueryLogMeta,
    normalizeQueryForLog
};
