const { executeQuery, executeQuerySingle } = require('./db-utils');

const Interests = {
    async getAll() {
        return await executeQuery(`
            SELECT * FROM interests 
            ORDER BY category, display_order ASC
        `);
    },

    async getByCategory(category) {
        return await executeQuery(`
            SELECT * FROM interests 
            WHERE category = ? 
            ORDER BY display_order ASC
        `, [category]);
    },

    async getById(id) {
        return await executeQuerySingle(`
            SELECT * FROM interests 
            WHERE id = ?
        `, [id]);
    },

    async create(data) {
        const { title, description, category, display_order } = data;
        const query = `
            INSERT INTO interests (title, description, category, display_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        `;
        const result = await executeQuery(query, [title, description, category, display_order]);
        return await this.getById(result.insertId);
    },

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

    async delete(id) {
        await executeQuery('DELETE FROM interests WHERE id = ?', [id]);
        return { success: true };
    },

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
