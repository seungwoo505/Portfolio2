const { executeQuery, executeQuerySingle } = require('./db-utils');

const Skills = {
    async getAllWithCategories() {
        return await executeQuery(`
            SELECT s.*, sc.name as category_name 
            FROM skills s
            LEFT JOIN skill_categories sc ON s.category_id = sc.id
            ORDER BY sc.display_order ASC, s.display_order ASC, s.name ASC
        `);
    },

    async getCategories() {
        return await executeQuery(`
            SELECT sc.*, COUNT(s.id) as skill_count
            FROM skill_categories sc
            LEFT JOIN skills s ON sc.id = s.category_id
            GROUP BY sc.id
            ORDER BY sc.display_order ASC
        `);
    },

    async getFeatured() {
        return await executeQuery(`
            SELECT s.*, sc.name as category_name 
            FROM skills s
            LEFT JOIN skill_categories sc ON s.category_id = sc.id
            WHERE s.is_featured = TRUE
            ORDER BY sc.display_order ASC, s.display_order ASC, s.name ASC
        `);
    },

    async createSkill(data) {
        const { category_id, name, proficiency_level, display_order, is_featured } = data;
        const query = `
            INSERT INTO skills (category_id, name, proficiency_level, display_order, is_featured)
            VALUES (?, ?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [category_id, name, proficiency_level, display_order || 0, is_featured || false]);
        return result.insertId;
    },

    async createCategory(data) {
        const { name, description, display_order } = data;
        const query = `
            INSERT INTO skill_categories (name, description, display_order)
            VALUES (?, ?, ?)
        `;
        const result = await executeQuery(query, [name, description, display_order || 0]);
        return result.insertId;
    },

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

    async getSkillById(id) {
        return await executeQuerySingle(`
            SELECT s.*, sc.name as category_name 
            FROM skills s
            LEFT JOIN skill_categories sc ON s.category_id = sc.id
            WHERE s.id = ?
        `, [id]);
    },

    async deleteSkill(id) {
        await executeQuery('DELETE FROM skills WHERE id = ?', [id]);
    },

    async getCategoryByName(name) {
        return await executeQuerySingle(`
            SELECT * FROM skill_categories WHERE name = ?
        `, [name]);
    },

    async createCategory(name) {
        const query = `
            INSERT INTO skill_categories (name, display_order)
            VALUES (?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM skill_categories sc))
        `;
        const result = await executeQuery(query, [name]);
        return result.insertId;
    },

    async deleteCategory(id) {
        await executeQuery('DELETE FROM skill_categories WHERE id = ?', [id]);
    },

    async getSkillsByCategory(categoryId) {
        return await executeQuery(`
            SELECT id, name FROM skills WHERE category_id = ?
        `, [categoryId]);
    },

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
