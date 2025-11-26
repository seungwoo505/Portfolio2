const { executeQuery, executeQuerySingle } = require('./db-utils');

const Skills = {
    /**
     * @description Retrieves Skills Model All With Categories.
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
     * @description Retrieves Skills Model Categories.
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
     * @description Retrieves Skills Model Featured.
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
     * @description Creates Skills Model Skill.
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async createSkill(data) {
        const { category_id, name, proficiency_level, display_order, is_featured } = data;
        const query = `
            INSERT INTO skills (category_id, name, proficiency_level, display_order, is_featured)
            VALUES (?, ?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [category_id, name, proficiency_level, display_order || 0, is_featured || false]);
        return result.insertId;
    },

    /**
     * @description Creates Skills Model Category.
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async createCategory(data) {
        const { name, description, display_order } = data;
        const query = `
            INSERT INTO skill_categories (name, description, display_order)
            VALUES (?, ?, ?)
        `;
        const result = await executeQuery(query, [name, description, display_order || 0]);
        return result.insertId;
    },

    /**
     * @description Updates Skills Model Skill.
      * @param {*} id 입력값
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async updateSkill(id, data) {
        const { category_id, name, proficiency_level, display_order, is_featured } = data;
        const query = `
            UPDATE skills 
            SET category_id = ?, name = ?, proficiency_level = ?, 
                display_order = ?, is_featured = ?, updated_at = NOW()
            WHERE id = ?
        `;
        await executeQuery(query, [category_id, name, proficiency_level, display_order, is_featured, id]);
        return await this.getSkillById(id);
    },

    /**
     * @description Retrieves Skills Model Skill By Id.
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

    /**
     * @description Deletes Skills Model Skill.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async deleteSkill(id) {
        await executeQuery('DELETE FROM skills WHERE id = ?', [id]);
    },

    async getCategoryByName(name) {
        return await executeQuerySingle(`
            SELECT * FROM skill_categories WHERE name = ?
        `, [name]);
    },

    /**
     * @description Creates Skills Model Category.
      * @param {*} name 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async createCategory(name) {
        const query = `
            INSERT INTO skill_categories (name, display_order)
            VALUES (?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM skill_categories sc))
        `;
        const result = await executeQuery(query, [name]);
        return result.insertId;
    },

    /**
     * @description Deletes Skills Model Category.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async deleteCategory(id) {
        await executeQuery('DELETE FROM skill_categories WHERE id = ?', [id]);
    },

    async getSkillsByCategory(categoryId) {
        return await executeQuery(`
            SELECT id, name FROM skills WHERE category_id = ?
        `, [categoryId]);
    },

    /**
     * @description Retrieves Skills Model By Display Order.
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

module.exports = Skills;
