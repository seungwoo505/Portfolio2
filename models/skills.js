const { executeQuery, executeQuerySingle } = require('./db-utils');

const Skills = {
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
     * @description 스킬 모델에 기술을 생성한다.
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async createSkill(data) {
        const { category_id, name, proficiency_level, display_order, is_featured } = data;
        const query = `
            INSERT INTO skills (category_id, name, proficiency_level, display_order, is_featured)
            VALUES (?, ?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [
            category_id,
            name,
            proficiency_level ?? 50,
            display_order ?? 0,
            is_featured ?? false
        ]);
        return result.insertId;
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

    /**
     * @description 스킬 모델의 기술 정보를 갱신한다.
      * @param {*} id 입력값
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async updateSkill(id, data) {
        const updateFields = [];
        const updateValues = [];
        const allowedFields = {
            category_id: data.category_id,
            name: data.name,
            proficiency_level: data.proficiency_level,
            display_order: data.display_order,
            is_featured: data.is_featured
        };

        for (const [field, value] of Object.entries(allowedFields)) {
            if (value !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(value);
            }
        }

        if (updateFields.length === 0) {
            return await this.getSkillById(id);
        }

        updateFields.push('updated_at = NOW()');
        updateValues.push(id);

        const query = `UPDATE skills SET ${updateFields.join(', ')} WHERE id = ?`;
        await executeQuery(query, updateValues);
        return await this.getSkillById(id);
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

    /**
     * @description 스킬 모델의 기술을 삭제한다.
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
     * @description 스킬 모델의 카테고리를 삭제한다.
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

module.exports = Skills;
