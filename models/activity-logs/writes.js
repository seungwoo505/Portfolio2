const { executeQuery } = require('./common');

module.exports = {
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
    },

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
};
