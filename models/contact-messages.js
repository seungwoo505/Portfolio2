const { executeQuery, executeQuerySingle } = require('./db-utils');

const ContactMessages = {
    /**
     * @description create for Contact Messages Model.
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async create(data) {
        const { name, email, subject, message, ip_address, user_agent } = data;
        const query = `
            INSERT INTO contact_messages (name, email, subject, message, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [name, email, subject, message, ip_address, user_agent]);
        return result.insertId;
    },

    /**
     * @description Retrieves Contact Messages Model All.
      * @param {*} limit 입력값
      * @param {*} offset 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getAll(limit = 50, offset = 0) {
        return await executeQuery(`
            SELECT * FROM contact_messages 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [limit, offset]);
    },

    /**
     * @description Retrieves Contact Messages Model By Id.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description mark As Read for Contact Messages Model.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async markAsRead(id) {
        await executeQuery('UPDATE contact_messages SET is_read = TRUE, read_at = NOW() WHERE id = ?', [id]);
        return await this.getById(id);
    },

    /**
     * @description mark As Replied for Contact Messages Model.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async markAsReplied(id) {
        await executeQuery('UPDATE contact_messages SET is_replied = TRUE WHERE id = ?', [id]);
        return await this.getById(id);
    },

    /**
     * @description mark Multiple As Read for Contact Messages Model.
      * @param {*} ids 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async markMultipleAsRead(ids) {
        if (!ids.length) return;
        const placeholders = ids.map(() => '?').join(',');
        await executeQuery(`UPDATE contact_messages SET is_read = TRUE, read_at = NOW() WHERE id IN (${placeholders})`, ids);
    },

    /**
     * @description delete for Contact Messages Model.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async delete(id) {
        await executeQuery('DELETE FROM contact_messages WHERE id = ?', [id]);
    },

    async deleteMultiple(ids) {
        if (!ids.length) return;
        const placeholders = ids.map(() => '?').join(',');
        await executeQuery(`DELETE FROM contact_messages WHERE id IN (${placeholders})`, ids);
    },

    /**
     * @description Retrieves Contact Messages Model Stats.
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description Retrieves Contact Messages Model By Email.
      * @param {*} email 입력값
      * @param {*} limit 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getByEmail(email, limit = 10) {
        return await executeQuery(`
            SELECT * FROM contact_messages 
            WHERE email = ?
            ORDER BY created_at DESC 
            LIMIT ?
        `, [email, limit]);
    },

    /**
     * @description search for Contact Messages Model.
      * @param {*} searchTerm 입력값
      * @param {*} limit 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description Retrieves Contact Messages Model Recent By Ip.
      * @param {*} ipAddress 입력값
      * @param {*} hours 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getRecentByIp(ipAddress, hours = 24) {
        return await executeQuery(`
            SELECT * FROM contact_messages 
            WHERE ip_address = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            ORDER BY created_at DESC
        `, [ipAddress, hours]);
    }
};

module.exports = ContactMessages;
