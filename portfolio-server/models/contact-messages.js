const { executeQuery, executeQuerySingle } = require('./db-utils');

const ContactMessages = {
    /**
     * @description 문의 메시지 모델에 데이터를 생성한다.
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
     * @description 문의 메시지 모델의 전체 목록을 조회한다.
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
     * @description 문의 메시지 모델에서 ID로 조회한다.
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
     * @description 문의 메시지 모델에서 메시지를 읽음 처리한다.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async markAsRead(id) {
        await executeQuery('UPDATE contact_messages SET is_read = TRUE, read_at = NOW() WHERE id = ?', [id]);
        return await this.getById(id);
    },

    /**
     * @description 문의 메시지 모델에서 답변 완료로 표시한다.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async markAsReplied(id) {
        await executeQuery('UPDATE contact_messages SET is_replied = TRUE WHERE id = ?', [id]);
        return await this.getById(id);
    },

    /**
     * @description 문의 메시지 모델에서 여러 메시지를 읽음 처리한다.
      * @param {*} ids 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async markMultipleAsRead(ids) {
        if (!ids.length) return;
        const placeholders = ids.map(() => '?').join(',');
        await executeQuery(`UPDATE contact_messages SET is_read = TRUE, read_at = NOW() WHERE id IN (${placeholders})`, ids);
    },

    /**
     * @description 문의 메시지 모델에서 메시지를 삭제한다.
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
     * @description 문의 메시지 모델의 통계를 조회한다.
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
     * @description 문의 메시지 모델에서 이메일로 조회한다.
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
     * @description 문의 메시지 모델에서 검색한다.
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
     * @description 문의 메시지 모델에서 IP별 최근 메시지를 조회한다.
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
