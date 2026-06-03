const { executeQuerySingle } = require('../db-utils');

const getStats = async () => (
    await executeQuerySingle(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread,
            SUM(CASE WHEN is_replied = FALSE THEN 1 ELSE 0 END) as unreplied,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
            SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as this_week,
            SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as this_month
        FROM contact_messages
    `)
);

module.exports = {
    getStats
};
