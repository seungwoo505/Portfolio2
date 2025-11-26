const { executeQuery, executeQuerySingle } = require('./db-utils');

const AdminActivityLogs = {
    /**
     * @description 관리자 활동 로그 모델에 기록한다.
      * @param {*} adminId 입력값
      * @param {*} action 입력값
      * @param {*} resourceType 입력값
      * @param {*} resourceId 입력값
      * @param {*} details 입력값
      * @param {*} ipAddress 입력값
      * @param {*} userAgent 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async log(adminId, action, resourceType = null, resourceId = null, details = null, ipAddress = null, userAgent = null) {
        const result = await executeQuery(`
            INSERT INTO admin_activity_logs (admin_id, action, resource_type, resource_id, details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [adminId, action, resourceType, resourceId, details, ipAddress, userAgent]);

        return result.insertId;
    },

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

    /**
     * @description 관리자 활동 로그 모델에서 관리자별 로그를 조회한다.
      * @param {*} adminId 입력값
      * @param {*} limit 입력값
      * @param {*} offset 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description 관리자 활동 로그 모델에서 리소스별 로그를 조회한다.
      * @param {*} resourceType 입력값
      * @param {*} resourceId 입력값
      * @param {*} limit 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description 관리자 활동 로그 모델에서 작업별 로그를 조회한다.
      * @param {*} action 입력값
      * @param {*} limit 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description 관리자 활동 로그 모델에서 기간별 로그를 조회한다.
      * @param {*} startDate 입력값
      * @param {*} endDate 입력값
      * @param {*} limit 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description 관리자 활동 로그 모델의 통계를 조회한다.
      * @param {*} days 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description 관리자 활동 로그 모델의 활동 통계를 조회한다.
      * @param {*} days 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description 관리자 활동 로그 모델의 리소스별 통계를 조회한다.
      * @param {*} days 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description 관리자 활동 로그 모델의 일별 통계를 조회한다.
      * @param {*} days 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description 관리자 활동 로그 모델에서 검색한다.
      * @param {*} searchTerm 입력값
      * @param {*} limit 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description 관리자 활동 로그 모델의 오래된 데이터를 정리한다.
      * @param {*} daysToKeep 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async cleanup(daysToKeep = 365) {
        const result = await executeQuery(`
            DELETE FROM admin_activity_logs 
            WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [daysToKeep]);

        return result.affectedRows;
    },

    /**
     * @description 관리자 활동 로그 모델에서 최근 활동을 조회한다.
      * @param {*} adminId 입력값
      * @param {*} limit 입력값
     * @returns {Promise<any>} 처리 결과
     */
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
