const { executeQuery, executeQuerySingle } = require('./db-utils');
const { clampInteger } = require('../utils/pagination');

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

const buildFilterWhere = (filters = {}) => {
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

class ActivityLogs {
    async create(data) {
        const {
            user_id,
            action,
            resource_type,
            resource_id,
            details,
            ip_address,
            user_agent
        } = data;

        const result = await executeQuery(`
            INSERT INTO admin_activity_logs (admin_id, action, resource_type, resource_id, details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            user_id,
            action,
            resource_type,
            resource_id || null,
            details || null,
            ip_address || null,
            user_agent || null
        ]);

        return { id: result.insertId, ...data };
    }

    async findWithFilters(filters = {}) {
        const { page = 1, limit = 50, offset } = filters;
        const pageLimit = clampInteger(limit, { min: 1, max: 10000, fallback: 50 });
        const pageOffset = offset === undefined
            ? (clampInteger(page, { min: 1, max: 10000, fallback: 1 }) - 1) * pageLimit
            : clampInteger(offset, { min: 0, max: 10000000, fallback: 0 });
        const { whereClause, values } = buildFilterWhere(filters);

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            ${whereClause}
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `, [...values, pageLimit, pageOffset]);
    }

    async countWithFilters(filters = {}) {
        const { whereClause, values } = buildFilterWhere(filters);
        const result = await executeQuerySingle(`
            SELECT COUNT(*) as total
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            ${whereClause}
        `, values);

        return result?.total || 0;
    }

    async getStats() {
        const stats = await executeQuerySingle(`
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today,
                COUNT(DISTINCT admin_id) as uniqueUsers,
                COUNT(DISTINCT resource_type) as uniqueResources
            FROM admin_activity_logs
        `);

        return stats || {
            total: 0,
            today: 0,
            uniqueUsers: 0,
            uniqueResources: 0
        };
    }

    async findByUser(userId, limit = 100) {
        const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.admin_id = ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [userId, pageLimit]);
    }

    async cleanupOldLogs(daysToKeep = 90) {
        const result = await executeQuery(`
            DELETE FROM admin_activity_logs
            WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [daysToKeep]);

        return result.affectedRows;
    }
}

module.exports = new ActivityLogs();
