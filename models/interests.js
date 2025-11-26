const { executeQuery, executeQuerySingle } = require('./db-utils');

const Interests = {
    /**
     * @description Retrieves Interests Model All.
     * @returns {Promise<any>} 처리 결과
     */
    async getAll() {
        return await executeQuery(`
            SELECT * FROM interests 
            ORDER BY category, display_order ASC
        `);
    },

    /**
     * @description Retrieves Interests Model By Category.
      * @param {*} category 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getByCategory(category) {
        return await executeQuery(`
            SELECT * FROM interests 
            WHERE category = ? 
            ORDER BY display_order ASC
        `, [category]);
    },

    /**
     * @description Retrieves Interests Model By Id.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getById(id) {
        return await executeQuerySingle(`
            SELECT * FROM interests 
            WHERE id = ?
        `, [id]);
    },

    /**
     * @description create for Interests Model.
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async create(data) {
        const { title, description, category, display_order } = data;
        const query = `
            INSERT INTO interests (title, description, category, display_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        `;
        const result = await executeQuery(query, [title, description, category, display_order]);
        return await this.getById(result.insertId);
    },

    /**
     * @description update for Interests Model.
      * @param {*} id 입력값
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async update(id, data) {
        const { title, description, category, display_order } = data;
        const query = `
            UPDATE interests 
            SET title = ?, description = ?, category = ?, display_order = ?, updated_at = NOW()
            WHERE id = ?
        `;
        await executeQuery(query, [title, description, category, display_order, id]);
        return await this.getById(id);
    },

    /**
     * @description delete for Interests Model.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async delete(id) {
        await executeQuery('DELETE FROM interests WHERE id = ?', [id]);
        return { success: true };
    },

    /**
     * @description Updates Interests Model Order.
      * @param {*} id 입력값
      * @param {*} display_order 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async updateOrder(id, display_order) {
        const query = `
            UPDATE interests 
            SET display_order = ?, updated_at = NOW()
            WHERE id = ?
        `;
        await executeQuery(query, [display_order, id]);
        return await this.getById(id);
    }
};

module.exports = Interests;
