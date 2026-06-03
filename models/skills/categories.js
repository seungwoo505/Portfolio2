const { executeQuery, executeQuerySingle } = require('./common');

module.exports = {
    /**
     * @description 스킬 모델의 카테고리를 조회한다.
     * @returns {Promise<any>} 처리 결과
     */
    async getCategories() {
        return await executeQuery(`
            SELECT sc.*, COUNT(s.id) as skill_count
            FROM skill_categories sc
            LEFT JOIN skills s ON sc.id = s.category_id
            GROUP BY sc.id
            ORDER BY sc.display_order ASC
        `);
    },

    /**
     * @description 스킬 모델에 카테고리를 생성한다.
     * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async createCategory(data) {
        const category = typeof data === 'string' ? { name: data } : data;
        const { name, description = null, display_order } = category;
        const finalDisplayOrder = display_order ?? (
            await executeQuerySingle('SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM skill_categories')
        ).next_order;
        const query = `
            INSERT INTO skill_categories (name, description, display_order)
            VALUES (?, ?, ?)
        `;
        const result = await executeQuery(query, [name, description, finalDisplayOrder]);
        return result.insertId;
    },

    async getCategoryByName(name) {
        return await executeQuerySingle(`
            SELECT * FROM skill_categories WHERE name = ?
        `, [name]);
    },

    async getCategoryById(id) {
        return await executeQuerySingle(`
            SELECT * FROM skill_categories WHERE id = ?
        `, [id]);
    },

    /**
     * @description 스킬 모델의 카테고리를 삭제한다.
     * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async deleteCategory(id) {
        await executeQuery('DELETE FROM skill_categories WHERE id = ?', [id]);
    }
};
