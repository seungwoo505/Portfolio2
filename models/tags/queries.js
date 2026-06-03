const { executeQuery, executeQuerySingle } = require('../db-utils');

const getAll = async ({ type = null } = {}) => {
    let query = `SELECT * FROM tags`;
    const params = [];
    if (type) {
        query += ` WHERE type = ?`;
        params.push(type);
    }
    query += ` ORDER BY usage_count DESC, name ASC`;
    return await executeQuery(query, params);
};

const getPopular = async (limit = 10, { type = null } = {}) => {
    let query = `SELECT * FROM tags WHERE usage_count > 0`;
    const params = [];
    if (type) {
        query += ` AND type = ?`;
        params.push(type);
    }
    query += ` ORDER BY usage_count DESC, name ASC LIMIT ?`;
    params.push(limit);
    return await executeQuery(query, params);
};

const getTopSkills = async (limit = 10, type = 'general') => {
    const query = `
        SELECT * FROM tags
        WHERE type = ? AND usage_count > 0
        ORDER BY usage_count DESC, name ASC
        LIMIT ?
    `;
    return await executeQuery(query, [type, limit]);
};

const getById = async (id) => (
    await executeQuerySingle('SELECT * FROM tags WHERE id = ?', [id])
);

const getBySlug = async (slug) => (
    await executeQuerySingle('SELECT * FROM tags WHERE slug = ?', [slug])
);

const getByName = async (name) => (
    await executeQuerySingle('SELECT * FROM tags WHERE name = ?', [name])
);

const search = async (searchTerm, limit = 10, { type = null } = {}) => {
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
};

module.exports = {
    getAll,
    getById,
    getByName,
    getBySlug,
    getPopular,
    getTopSkills,
    search
};
