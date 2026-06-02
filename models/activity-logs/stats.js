const {
    buildFilterWhere,
    clampInteger,
    executeQuery,
    executeQuerySingle
} = require('./common');

module.exports = {
    async countWithFilters(filters = {}) {
        const { whereClause, values } = buildFilterWhere(filters);
        const result = await executeQuerySingle(`
            SELECT COUNT(*) as total
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            ${whereClause}
        `, values);

        return result?.total || 0;
    },

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
    },

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
    },

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
    },

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
};
