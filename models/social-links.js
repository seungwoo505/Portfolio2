const { executeQuery, executeQuerySingle } = require('./db-utils');

const SocialLinks = {
    /**
     * @description 소셜 링크 모델의 전체 목록을 조회한다.
     * @returns {Promise<any>} 처리 결과
     */
    async getAll({ includeInactive = false } = {}) {
        const whereClause = includeInactive ? '' : 'WHERE is_active = TRUE';
        return await executeQuery(`
            SELECT * FROM social_links 
            ${whereClause}
            ORDER BY display_order ASC, id ASC
        `);
    },

    /**
     * @description 소셜 링크 모델에 항목을 생성한다.
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async create(data) {
        const { platform, url, icon, display_order, is_active = true } = data;
        const query = `
            INSERT INTO social_links (platform, url, icon, display_order, is_active) 
            VALUES (?, ?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [platform, url, icon, display_order ?? 0, is_active]);
        return result.insertId;
    },

    /**
     * @description 소셜 링크 모델의 정보를 수정한다.
      * @param {*} id 입력값
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async update(id, data) {
        const updateFields = [];
        const updateValues = [];
        const allowedFields = {
            platform: data.platform,
            url: data.url,
            icon: data.icon,
            display_order: data.display_order,
            is_active: data.is_active
        };

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

        const query = `UPDATE social_links SET ${updateFields.join(', ')} WHERE id = ?`;
        await executeQuery(query, updateValues);
        return await this.getById(id);
    },

    /**
     * @description 소셜 링크 모델에서 ID로 조회한다.
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
