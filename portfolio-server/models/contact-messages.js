const { executeQuery, executeQuerySingle } = require('./db-utils');

const ContactMessages = {
    async create(data) {
        const { name, email, subject, message, ip_address, user_agent } = data;
        const query = `
            INSERT INTO contact_messages (name, email, subject, message, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [name, email, subject, message, ip_address, user_agent]);
        return result.insertId;
    },

    async getAll(limit = 50, offset = 0) {
        return await executeQuery(`
            SELECT * FROM contact_messages 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [limit, offset]);
    },

    async getById(id) {
        return await executeQuerySingle('SELECT * FROM contact_messages WHERE id = ?', [id]);
    },

    async getUnread(limit = 50) {
        return await executeQuery(`
            SELECT * FROM contact_messages 
            WHERE is_read = FALSE
            ORDER BY created_at DESC 
            LIMIT ?
        `, [limit]);
    },

    async markAsRead(id) {
        await executeQuery('UPDATE contact_messages SET is_read = TRUE, read_at = NOW() WHERE id = ?', [id]);
        return await this.getById(id);
    },

    async markAsReplied(id) {
        await executeQuery('UPDATE contact_messages SET is_replied = TRUE WHERE id = ?', [id]);
        return await this.getById(id);
    },

    async markMultipleAsRead(ids) {
        if (!ids.length) return;
        const placeholders = ids.map(() => '?').join(',');
        await executeQuery(`UPDATE contact_messages SET is_read = TRUE, read_at = NOW() WHERE id IN (${placeholders})`, ids);
    },

    async delete(id) {
        await executeQuery('DELETE FROM contact_messages WHERE id = ?', [id]);
    },

    async deleteMultiple(ids) {
        if (!ids.length) return;
        const placeholders = ids.map(() => '?').join(',');
        await executeQuery(`DELETE FROM contact_messages WHERE id IN (${placeholders})`, ids);
    },

    async getStats() {
        const stats = await executeQuerySingle(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread,
                SUM(CASE WHEN is_replied = FALSE THEN 1 ELSE 0 END) as unreplied,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as this_week,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as this_month
            FROM contact_messages
        `);
        
        return stats;
    },

    async getByEmail(email, limit = 10) {
        return await executeQuery(`
            SELECT * FROM contact_messages 
            WHERE email = ?
            ORDER BY created_at DESC 
            LIMIT ?
        `, [email, limit]);
    },

    async search(searchTerm, limit = 50) {
        const query = `
            SELECT * FROM contact_messages 
            WHERE name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?
            ORDER BY created_at DESC 
            LIMIT ?
        `;
        const term = `%${searchTerm}%`;
        return await executeQuery(query, [term, term, term, term, limit]);
    },

    async getRecentByIp(ipAddress, hours = 24) {
        return await executeQuery(`
            SELECT * FROM contact_messages 
            WHERE ip_address = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            ORDER BY created_at DESC
        `, [ipAddress, hours]);
    }
};

module.exports = ContactMessages;
