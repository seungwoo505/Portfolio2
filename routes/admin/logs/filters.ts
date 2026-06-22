const { toChoice, toStringValue } = require('../../../utils/filter-values');

const normalizeLogFilters = (query: Record<string, any> = {}) => ({
    search: toStringValue(query.search),
    user: toStringValue(query.user, 'all').trim() || 'all',
    action: toStringValue(query.action, 'all').trim() || 'all',
    resource_type: toStringValue(query.resource_type, 'all').trim() || 'all',
    date_filter: toChoice(query.date_filter, ['all', 'today', 'yesterday', 'week', 'month'], 'all')
});

module.exports = {
    normalizeLogFilters
};
export {};
