const { executeQuery, executeQuerySingle } = require('./db-utils');

const AdminActivityLogs = {
    // 활동 로그 기록
    async log(adminId, action, resourceType = null, resourceId = null, details = null, ipAddress = null, userAgent = null) {
        const result = await executeQuery(`
            INSERT INTO admin_activity_logs (admin_id, action, resource_type, resource_id, details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [adminId, action, resourceType, resourceId, details, ipAddress, userAgent]);

        return result.insertId;
    },

    // 모든 활동 로그 조회
    async getAll(limit = 50, offset = 0) {
        return await executeQuery(`
            SELECT 
                u.username,
                l.action,
                l.resource_type,
                l.details,
                l.ip_address,
                l.user_agent,
                l.created_at
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
    },

    // 특정 관리자의 활동 로그 조회
    async getByAdmin(adminId, limit = 50, offset = 0) {
        return await executeQuery(`
            SELECT 
                u.username,
                l.action,
                l.resource_type,
                l.details,
                l.ip_address,
                l.user_agent,
                l.created_at
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.admin_id = ?
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `, [adminId, limit, offset]);
    },

    // 특정 리소스의 활동 로그 조회
    async getByResource(resourceType, resourceId, limit = 20) {
        return await executeQuery(`
            SELECT 
                u.username,
                l.action,
                l.resource_type,
                l.details,
                l.ip_address,
                l.user_agent,
                l.created_at
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.resource_type = ? AND l.resource_id = ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [resourceType, resourceId, limit]);
    },

    // 특정 액션의 로그 조회
    async getByAction(action, limit = 100) {
        return await executeQuery(`
            SELECT 
                u.username,
                l.action,
                l.resource_type,
                l.details,
                l.ip_address,
                l.user_agent,
                l.created_at
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.action = ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [action, limit]);
    },

    // 날짜 범위로 로그 조회
    async getByDateRange(startDate, endDate, limit = 100) {
        return await executeQuery(`
            SELECT 
                u.username,
                l.action,
                l.resource_type,
                l.details,
                l.ip_address,
                l.user_agent,
                l.created_at
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.created_at BETWEEN ? AND ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [startDate, endDate, limit]);
    },

    // 통계 조회
    async getStats(days = 30) {
        const stats = await executeQuerySingle(`
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
        `, [days]);

        return stats;
    },

    // 활동별 통계
    async getActivityStats(days = 30) {
        return await executeQuery(`
            SELECT 
                action,
                COUNT(*) as count,
                COUNT(DISTINCT admin_id) as unique_admins
            FROM admin_activity_logs
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY action
            ORDER BY count DESC
        `, [days]);
    },

    // 리소스별 통계
    async getResourceStats(days = 30) {
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
        `, [days]);
    },

    // 일별 활동 통계
    async getDailyStats(days = 30) {
        return await executeQuery(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as activities,
                COUNT(DISTINCT admin_id) as active_admins
            FROM admin_activity_logs
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `, [days]);
    },

    // 로그 검색
    async search(searchTerm, limit = 50) {
        return await executeQuery(`
            SELECT 
                u.username,
                l.action,
                l.resource_type,
                l.details,
                l.ip_address,
                l.user_agent,
                l.created_at
            FROM admin_activity_logs l
            LEFT JOIN admin_users u ON l.admin_id = u.id
            WHERE l.action LIKE ? 
               OR l.resource_type LIKE ?
               OR l.details LIKE ?
               OR u.username LIKE ?
               OR u.full_name LIKE ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, limit]);
    },

    // 오래된 로그 정리 (데이터 보관 정책)
    async cleanup(daysToKeep = 365) {
        const result = await executeQuery(`
            DELETE FROM admin_activity_logs 
            WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [daysToKeep]);

        return result.affectedRows;
    },

    // 특정 관리자의 최근 활동
    async getRecentActivity(adminId, limit = 10) {
        return await executeQuery(`
            SELECT 
                l.action,
                l.resource_type,
                l.details,
                l.ip_address,
                l.user_agent,
                l.created_at
            FROM admin_activity_logs l
            WHERE l.admin_id = ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [adminId, limit]);
    }
};

module.exports = AdminActivityLogs;
