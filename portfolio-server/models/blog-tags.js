const { executeQuery, executeQuerySingle } = require('./db-utils');

const BlogTags = {
    /**
     * @description Retrieves Blog Tags Model All.
     * @returns {Promise<any>} 처리 결과
     */
    async getAll() {
        return await executeQuery(`
            SELECT * FROM tags 
            WHERE type IN ('blog','general')
            ORDER BY usage_count DESC, name ASC
        `);
    },

    /**
     * @description Retrieves Blog Tags Model Popular.
      * @param {*} limit 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getPopular(limit = 10) {
        return await executeQuery(`
            SELECT * FROM tags 
            WHERE usage_count > 0 AND type IN ('blog','general')
            ORDER BY usage_count DESC, name ASC
            LIMIT ?
        `, [limit]);
    },

    /**
     * @description Retrieves Blog Tags Model By Id.
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
     * @description Retrieves Blog Tags Model By Name.
      * @param {*} name 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getByName(name) {
        return await executeQuerySingle(`SELECT * FROM tags WHERE name = ? AND type IN ('blog','general')`, [name]);
    },

    async create(data) {
        const { name, slug, description, color } = data;
        const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim('-');
        
        const query = `
            INSERT INTO tags (name, slug, description, color, type)
            VALUES (?, ?, ?, ?, 'blog')
        `;
        const result = await executeQuery(query, [name, finalSlug, description, color]);
        return result.insertId;
    },

    /**
     * @description update for Blog Tags Model.
      * @param {*} id 입력값
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async update(id, data) {
        const { name, slug, description, color } = data;
        const query = `
            UPDATE tags 
            SET name = COALESCE(?, name), 
                slug = COALESCE(?, slug), 
                description = COALESCE(?, description), 
                color = COALESCE(?, color),
                updated_at = NOW()
            WHERE id = ?
        `;
        await executeQuery(query, [name, slug, description, color, id]);
        return await this.getById(id);
    },

    /**
     * @description delete for Blog Tags Model.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async delete(id) {
        await executeQuery('DELETE FROM tag_usage WHERE tag_id = ?', [id]);
        await executeQuery('DELETE FROM tags WHERE id = ?', [id]);
    },

    /**
     * @description Updates Blog Tags Model Post Count.
     * @returns {Promise<any>} 처리 결과
     */
    async updatePostCount() {
        await executeQuery(`
            UPDATE tags t
            LEFT JOIN (
                SELECT tag_id, COUNT(*) AS cnt FROM tag_usage GROUP BY tag_id
            ) u ON t.id = u.tag_id
            SET t.usage_count = COALESCE(u.cnt, 0)
        `);
    },

    /**
     * @description search for Blog Tags Model.
      * @param {*} searchTerm 입력값
      * @param {*} limit 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async search(searchTerm, limit = 10) {
        const query = `
            SELECT * FROM tags 
            WHERE (name LIKE ? OR description LIKE ?) AND type IN ('blog','general')
            ORDER BY usage_count DESC, name ASC
            LIMIT ?
        `;
        const term = `%${searchTerm}%`;
        return await executeQuery(query, [term, term, limit]);
    }
};

module.exports = BlogTags;
