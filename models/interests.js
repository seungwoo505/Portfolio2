const { executeQuery, executeQuerySingle } = require('./db-utils');

const Interests = {
    /**
     * @description 관심사 모델의 전체 목록을 조회한다.
     * @returns {Promise<any>} 처리 결과
     */
    async getAll() {
        return await executeQuery(`
            SELECT * FROM interests 
            ORDER BY category, display_order ASC
        `);
    },

    /**
     * @description 관심사 모델에서 카테고리별로 조회한다.
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
     * @description 관심사 모델에서 ID로 조회한다.
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
     * @description 관심사 모델에 항목을 생성한다.
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async create(data) {
        const { title, description, icon, category, display_order } = data;
        const query = `
            INSERT INTO interests (title, description, icon, category, display_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        `;
        const result = await executeQuery(query, [title, description, icon, category, display_order]);
        return await this.getById(result.insertId);
    },

    /**
     * @description 관심사 모델의 정보를 수정한다.
      * @param {*} id 입력값
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async update(id, data) {
        const allowedFields = {
            title: data.title,
            description: data.description,
            icon: data.icon,
            category: data.category,
            display_order: data.display_order
        };
        const updateFields = [];
        const updateValues = [];

        for (const [field, value] of Object.entries(allowedFields)) {
            if (value !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(value);
            }
        }

        if (updateFields.length === 0) {
            return await this.getById(id);
        }

        updateFields.push('updated_at = NOW()');
        updateValues.push(id);

        const query = `UPDATE interests SET ${updateFields.join(', ')} WHERE id = ?`;
        await executeQuery(query, updateValues);
        return await this.getById(id);
    },

    /**
     * @description 관심사 모델에서 항목을 삭제한다.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async delete(id) {
        await executeQuery('DELETE FROM interests WHERE id = ?', [id]);
        return { success: true };
    },

    /**
     * @description 관심사 모델의 노출 순서를 갱신한다.
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
