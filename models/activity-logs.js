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
    async log(adminId, action, resourceType = null, resourceId = null, details = null, ipAddress = null, userAgent = null) {
        const result = await executeQuery(`
            INSERT INTO admin_activity_logs (admin_id, action, resource_type, resource_id, details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            adminId,
            action,
            resourceType,
            resourceId ?? null,
            details ?? null,
            ipAddress ?? null,
            userAgent ?? null
        ]);

        return result.insertId;
    }

    async create(data) {
        const id = await this.log(
            data.user_id,
            data.action,
            data.resource_type,
            data.resource_id,
            data.details,
            data.ip_address,
            data.user_agent
        );

        return { id, ...data };
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

    async getAll(limit = 50, offset = 0) {
        const pageLimit = clampInteger(limit, { min: 1, max: 10000, fallback: 50 });
        const pageOffset = clampInteger(offset, { min: 0, max: 10000000, fallback: 0 });

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `, [pageLimit, pageOffset]);
    }

    async getByAdmin(adminId, limit = 50, offset = 0) {
        const pageLimit = clampInteger(limit, { min: 1, max: 10000, fallback: 50 });
        const pageOffset = clampInteger(offset, { min: 0, max: 10000000, fallback: 0 });

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.admin_id = ?
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `, [adminId, pageLimit, pageOffset]);
    }

    async getByResource(resourceType, resourceId, limit = 20) {
        const pageLimit = clampInteger(limit, { min: 1, max: 10000, fallback: 20 });

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.resource_type = ? AND l.resource_id = ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [resourceType, resourceId, pageLimit]);
    }

    async getByAction(action, limit = 100) {
        const pageLimit = clampInteger(limit, { min: 1, max: 10000, fallback: 100 });

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.action = ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [action, pageLimit]);
    }

    async getByDateRange(startDate, endDate, limit = 100) {
        const pageLimit = clampInteger(limit, { min: 1, max: 10000, fallback: 100 });

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.created_at BETWEEN ? AND ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [startDate, endDate, pageLimit]);
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

    async getStats(days = null) {
        if (days !== null && days !== undefined) {
            const periodDays = clampInteger(days, { min: 1, max: 3650, fallback: 30 });
            return await executeQuerySingle(`
                SELECT
                    COUNT(*) as total_activities,
                    COUNT(DISTINCT admin_id) as active_admins,
                    COUNT(DISTINCT DATE(created_at)) as active_days,
                    COUNT(CASE WHEN action LIKE '%create%' THEN 1 END) as creates,
                    COUNT(CASE WHEN action LIKE '%update%' THEN 1 END) as updates,
                    COUNT(CASE WHEN action LIKE '%delete%' THEN 1 END) as deletes,
                    COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as today,
                    COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as this_week
                FROM admin_activity_logs
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            `, [periodDays]);
        }

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

    async getActivityStats(days = 30) {
        const periodDays = clampInteger(days, { min: 1, max: 3650, fallback: 30 });

        return await executeQuery(`
            SELECT
                action,
                COUNT(*) as count,
                COUNT(DISTINCT admin_id) as unique_admins
            FROM admin_activity_logs
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY action
            ORDER BY count DESC
        `, [periodDays]);
    }

    async getResourceStats(days = 30) {
        const periodDays = clampInteger(days, { min: 1, max: 3650, fallback: 30 });

        return await executeQuery(`
            SELECT
                resource_type,
                COUNT(*) as count,
                COUNT(DISTINCT resource_id) as unique_resources,
                COUNT(DISTINCT admin_id) as unique_admins
            FROM admin_activity_logs
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND resource_type IS NOT NULL
            GROUP BY resource_type
            ORDER BY count DESC
        `, [periodDays]);
    }

    async getDailyStats(days = 30) {
        const periodDays = clampInteger(days, { min: 1, max: 3650, fallback: 30 });

        return await executeQuery(`
            SELECT
                DATE(created_at) as date,
                COUNT(*) as activities,
                COUNT(DISTINCT admin_id) as active_admins
            FROM admin_activity_logs
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `, [periodDays]);
    }

    async search(searchTerm, limit = 50) {
        const pageLimit = clampInteger(limit, { min: 1, max: 10000, fallback: 50 });
        const searchPattern = `%${searchTerm}%`;

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.action LIKE ?
               OR l.resource_type LIKE ?
               OR COALESCE(l.details, '') LIKE ?
               OR u.username LIKE ?
               OR u.full_name LIKE ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, pageLimit]);
    }

    async findByUser(userId, limit = 100) {
        const pageLimit = clampInteger(limit, { min: 1, max: 10000, fallback: 100 });

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.admin_id = ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [userId, pageLimit]);
    }

    async getRecentActivity(adminId, limit = 10) {
        return await this.findByUser(adminId, limit);
    }

    async cleanupOldLogs(daysToKeep = 90) {
        const retentionDays = clampInteger(daysToKeep, { min: 1, max: 3650, fallback: 90 });
        const result = await executeQuery(`
            DELETE FROM admin_activity_logs
            WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [retentionDays]);

        return result.affectedRows;
    }

    async cleanup(daysToKeep = 365) {
        return await this.cleanupOldLogs(daysToKeep);
    }
}

module.exports = new ActivityLogs();
