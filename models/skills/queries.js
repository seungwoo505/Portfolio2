const { executeQuery, executeQuerySingle } = require('./common');

module.exports = {
    /**
     * @description 스킬 모델의 전체 목록을 카테고리와 함께 조회한다.
     * @returns {Promise<any>} 처리 결과
     */
    async getAll() {
        return await this.getAllWithCategories();
    },

    /**
     * @description 스킬 모델의 전체 목록을 카테고리와 함께 조회한다.
     * @returns {Promise<any>} 처리 결과
     */
    async getAllWithCategories() {
        return await executeQuery(`
            SELECT s.*, sc.name as category_name 
            FROM skills s
            LEFT JOIN skill_categories sc ON s.category_id = sc.id
            ORDER BY sc.display_order ASC, s.display_order ASC, s.name ASC
        `);
    },

    /**
     * @description 스킬 모델에서 추천 스킬을 조회한다.
     * @returns {Promise<any>} 처리 결과
     */
    async getFeatured() {
        return await executeQuery(`
            SELECT s.*, sc.name as category_name 
            FROM skills s
            LEFT JOIN skill_categories sc ON s.category_id = sc.id
            WHERE s.is_featured = TRUE
            ORDER BY sc.display_order ASC, s.display_order ASC, s.name ASC
        `);
    },

    /**
     * @description 스킬 모델에서 ID로 기술을 조회한다.
     * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getSkillById(id) {
        return await executeQuerySingle(`
            SELECT s.*, sc.name as category_name 
            FROM skills s
            LEFT JOIN skill_categories sc ON s.category_id = sc.id
            WHERE s.id = ?
        `, [id]);
    },

    async getSkillsByCategory(categoryId) {
        return await executeQuery(`
            SELECT id, name FROM skills WHERE category_id = ?
        `, [categoryId]);
    },

    /**
     * @description 스킬 모델을 노출 순서로 조회한다.
     * @param {*} displayOrder 입력값
     * @param {*} excludeId 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getByDisplayOrder(displayOrder, excludeId = null) {
        let query = `
            SELECT id, name, display_order FROM skills WHERE display_order = ? AND is_featured = TRUE
        `;
        let params = [displayOrder];

        if (excludeId) {
            query += ` AND id != ?`;
            params.push(excludeId);
        }

        return await executeQuerySingle(query, params);
    }
};
