const {
    buildFilterWhere,
    clampInteger,
    executeQuery,
    parseLimit,
    selectColumns
} = require('./common');

module.exports = {
    async findWithFilters(filters = {}) {
        const { page = 1, limit = 50, offset } = filters;
        const pageLimit = parseLimit(limit, 50);
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
    },

    async getAll(limit = 50, offset = 0) {
        const pageLimit = parseLimit(limit, 50);
        const pageOffset = clampInteger(offset, { min: 0, max: 10000000, fallback: 0 });

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `, [pageLimit, pageOffset]);
    },

    async getByAdmin(adminId, limit = 50, offset = 0) {
        const pageLimit = parseLimit(limit, 50);
        const pageOffset = clampInteger(offset, { min: 0, max: 10000000, fallback: 0 });

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.admin_id = ?
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `, [adminId, pageLimit, pageOffset]);
    },

    async getByResource(resourceType, resourceId, limit = 20) {
        const pageLimit = parseLimit(limit, 20);

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.resource_type = ? AND l.resource_id = ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [resourceType, resourceId, pageLimit]);
    },

    async getByAction(action, limit = 100) {
        const pageLimit = parseLimit(limit, 100);

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.action = ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [action, pageLimit]);
    },

    async getByDateRange(startDate, endDate, limit = 100) {
        const pageLimit = parseLimit(limit, 100);

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.created_at BETWEEN ? AND ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [startDate, endDate, pageLimit]);
    },

    async search(searchTerm, limit = 50) {
        const pageLimit = parseLimit(limit, 50);
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
    },

    async findByUser(userId, limit = 100) {
        const pageLimit = parseLimit(limit, 100);

        return await executeQuery(`
            SELECT ${selectColumns}
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.admin_id = ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [userId, pageLimit]);
    },

    async getRecentActivity(adminId, limit = 10) {
        return await this.findByUser(adminId, limit);
    }
};
