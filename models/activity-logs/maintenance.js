const {
    clampInteger,
    executeQuery
} = require('./common');

module.exports = {
    async cleanupOldLogs(daysToKeep = 90) {
        const retentionDays = clampInteger(daysToKeep, { min: 1, max: 3650, fallback: 90 });
        const result = await executeQuery(`
            DELETE FROM admin_activity_logs
            WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [retentionDays]);

        return result.affectedRows;
    },

    async cleanup(daysToKeep = 365) {
        return await this.cleanupOldLogs(daysToKeep);
    }
};
