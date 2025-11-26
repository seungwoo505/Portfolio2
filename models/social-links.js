const { executeQuery, executeQuerySingle } = require('./db-utils');

const SocialLinks = {
    /**
     * @description Retrieves Social Links Model All.
     * @returns {Promise<any>} 처리 결과
     */
    async getAll() {
        return await executeQuery(`
            SELECT * FROM social_links 
            WHERE is_active = TRUE 
            ORDER BY display_order ASC, id ASC
        `);
    },

    /**
     * @description create for Social Links Model.
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async create(data) {
        const { platform, url, icon, display_order } = data;
        const query = `
            INSERT INTO social_links (platform, url, icon, display_order) 
            VALUES (?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [platform, url, icon, display_order || 0]);
        return result.insertId;
    },

    /**
     * @description update for Social Links Model.
      * @param {*} id 입력값
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async update(id, data) {
        const { platform, url, icon, display_order, is_active } = data;
        const query = `
            UPDATE social_links 
            SET platform = ?, url = ?, icon = ?, display_order = ?, is_active = ?, updated_at = NOW()
            WHERE id = ?
        `;
        await executeQuery(query, [platform, url, icon, display_order, is_active, id]);
        return await this.getById(id);
    },

    /**
     * @description Retrieves Social Links Model By Id.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getById(id) {
        return await executeQuerySingle('SELECT * FROM social_links WHERE id = ?', [id]);
    },

    async delete(id) {
        await executeQuery('DELETE FROM social_links WHERE id = ?', [id]);
    }
};

module.exports = SocialLinks;
