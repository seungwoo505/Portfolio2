const { executeQuery, executeQuerySingle } = require('./db-utils');

const Tags = {
    /**
     * @description Retrieves Tags Model All.
      * @param {*} type 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getAll({ type = null } = {}) {
        let query = `SELECT * FROM tags`;
        const params = [];
        if (type) {
            query += ` WHERE type = ?`;
            params.push(type);
        }
        query += ` ORDER BY usage_count DESC, name ASC`;
        return await executeQuery(query, params);
    },

    /**
     * @description Retrieves Tags Model Popular.
      * @param {*} limit 입력값
      * @param {*} type 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getPopular(limit = 10, { type = null } = {}) {
        let query = `SELECT * FROM tags WHERE usage_count > 0`;
        const params = [];
        if (type) {
            query += ` AND type = ?`;
            params.push(type);
        }
        query += ` ORDER BY usage_count DESC, name ASC LIMIT ?`;
        params.push(limit);
        return await executeQuery(query, params);
    },

    /**
     * @description Retrieves Tags Model Top Skills.
      * @param {*} limit 입력값
      * @param {*} type 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getTopSkills(limit = 10, type = 'general') {
        let query = `SELECT * FROM tags WHERE type = ? AND usage_count > 0 ORDER BY usage_count DESC, name ASC LIMIT ?`;
        const params = [type, limit];
        return await executeQuery(query, params);
    },

    /**
     * @description Retrieves Tags Model By Id.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getById(id) {
        return await executeQuerySingle('SELECT * FROM tags WHERE id = ?', [id]);
    },

    async getBySlug(slug) {
        return await executeQuerySingle('SELECT * FROM tags WHERE slug = ?', [slug]);
    },

    /**
     * @description Retrieves Tags Model By Name.
      * @param {*} name 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getByName(name) {
        return await executeQuerySingle('SELECT * FROM tags WHERE name = ?', [name]);
    },

    async create(data) {
        const { name, slug, description, color, type = 'general' } = data;
        const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim('-');
        
        const cleanParams = [
            name,
            finalSlug,
            description === undefined ? null : description,
            color,
            type
        ];
        
        const query = `
            INSERT INTO tags (name, slug, description, color, type)
            VALUES (?, ?, ?, ?, ?)
        `;
        const result = await executeQuery(query, cleanParams);
        return result.insertId;
    },

    /**
     * @description update for Tags Model.
      * @param {*} id 입력값
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async update(id, data) {
        const { name, slug, description, color, type } = data;
        
        const cleanParams = [
            name,
            slug,
            description === undefined ? null : description,
            color,
            type,
            id
        ];
        
        const query = `
            UPDATE tags
            SET name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                description = ?,
                color = COALESCE(?, color),
                type = COALESCE(?, type),
                updated_at = NOW()
            WHERE id = ?
        `;
        await executeQuery(query, cleanParams);
        return await this.getById(id);
    },

    /**
     * @description delete for Tags Model.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async delete(id) {
        await executeQuery('DELETE FROM tag_usage WHERE tag_id = ?', [id]);
        await executeQuery('DELETE FROM tags WHERE id = ?', [id]);
    },

    /**
     * @description search for Tags Model.
      * @param {*} searchTerm 입력값
      * @param {*} limit 입력값
      * @param {*} type 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async search(searchTerm, limit = 10, { type = null } = {}) {
        let query = `
            SELECT * FROM tags
            WHERE (name LIKE ? OR description LIKE ?)
        `;
        const params = [`%${searchTerm}%`, `%${searchTerm}%`];
        if (type) {
            query += ` AND type = ?`;
            params.push(type);
        }
        query += ` ORDER BY usage_count DESC, name ASC LIMIT ?`;
        params.push(limit);
        return await executeQuery(query, params);
    },

    /**
     * @description Updates Tags Model Usage Counts.
     * @returns {Promise<any>} 처리 결과
     */
    async updateUsageCounts() {
        await executeQuery(`
            UPDATE tags t
            LEFT JOIN (
                SELECT tag_id, COUNT(*) AS cnt FROM tag_usage GROUP BY tag_id
            ) u ON t.id = u.tag_id
            SET t.usage_count = COALESCE(u.cnt, 0)
        `);
    }
};

module.exports = Tags;


