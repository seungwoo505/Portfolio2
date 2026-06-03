const { executeQuery, executeQuerySingle } = require('../db-utils');

const getRecentByIp = async (ipAddress, hours = 24) => (
    await executeQuery(`
        SELECT * FROM contact_messages 
        WHERE ip_address = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        ORDER BY created_at DESC
    `, [ipAddress, hours])
);

const countRecentByIp = async (ipAddress, hours = 1) => {
    const result = await executeQuerySingle(`
        SELECT COUNT(*) AS total
        FROM contact_messages
        WHERE ip_address = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    `, [ipAddress, hours]);

    return Number(result?.total || 0);
};

module.exports = {
    countRecentByIp,
    getRecentByIp
};
