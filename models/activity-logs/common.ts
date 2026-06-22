const { executeQuery, executeQuerySingle } = require('../db-utils');
const { clampInteger } = require('../../utils/pagination');

const buildDateCondition = (dateFilter) => {
    switch (dateFilter) {
        case 'today':
            return 'DATE(l.created_at) = CURDATE()';
        case 'yesterday':
            return 'DATE(l.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
        case 'week':
            return 'l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        case 'month':
            return 'l.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        default:
            return null;
    }
};

const buildFilterWhere = (filters: Record<string, any> = {}) => {
    const {
        search = '',
        user = 'all',
        action = 'all',
        resource_type = 'all',
        date_filter = 'all'
    } = filters;
    const where = [];
    const values = [];

    if (search) {
        where.push(`(
            u.username LIKE ? OR
            l.action LIKE ? OR
            l.resource_type LIKE ? OR
            COALESCE(l.details, '') LIKE ?
        )`);
        const searchPattern = `%${search}%`;
        values.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (user !== 'all') {
        where.push('u.username = ?');
        values.push(user);
    }

    if (action !== 'all') {
        where.push('l.action = ?');
        values.push(action);
    }

    if (resource_type !== 'all') {
        where.push('l.resource_type = ?');
        values.push(resource_type);
    }

    const dateCondition = buildDateCondition(date_filter);
    if (dateCondition) {
        where.push(dateCondition);
    }

    return {
        whereClause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
        values
    };
};

const selectColumns = `
    l.id,
    l.admin_id as user_id,
    u.username,
    l.action,
    l.resource_type,
    l.resource_id,
    NULL as resource_name,
    l.details,
    l.ip_address,
    l.user_agent,
    l.created_at
`;

const parseLimit = (limit, fallback = 50) => (
    clampInteger(limit, { min: 1, max: 10000, fallback })
);

module.exports = {
    buildFilterWhere,
    clampInteger,
    executeQuery,
    executeQuerySingle,
    parseLimit,
    selectColumns
};
export {};
