const { executeQuery, executeQuerySingle } = require('../db-utils');

const getAll = async (limit = 50, offset = 0) => (
    await executeQuery(`
        SELECT * FROM contact_messages 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    `, [limit, offset])
);

const getById = async (id) => (
    await executeQuerySingle('SELECT * FROM contact_messages WHERE id = ?', [id])
);

const getUnread = async (limit = 50, offset = 0) => (
    await executeQuery(`
        SELECT * FROM contact_messages 
        WHERE is_read = FALSE
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    `, [limit, offset])
);

const countAll = async ({ unread = null } = {}) => {
    const whereClause = unread === true ? 'WHERE is_read = FALSE' : '';
    const result = await executeQuerySingle(`
        SELECT COUNT(*) AS total
        FROM contact_messages
        ${whereClause}
    `);

    return Number(result?.total || 0);
};

const getByEmail = async (email, limit = 10) => (
    await executeQuery(`
        SELECT * FROM contact_messages 
        WHERE email = ?
        ORDER BY created_at DESC 
        LIMIT ?
    `, [email, limit])
);

const search = async (searchTerm, limit = 50) => {
    const query = `
        SELECT * FROM contact_messages 
        WHERE name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?
        ORDER BY created_at DESC 
        LIMIT ?
    `;
    const term = `%${searchTerm}%`;
    return await executeQuery(query, [term, term, term, term, limit]);
};

module.exports = {
    countAll,
    getAll,
    getByEmail,
    getById,
    getUnread,
    search
};
export {};
