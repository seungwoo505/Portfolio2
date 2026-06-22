const { executeQuery, executeQuerySingle } = require('../db-utils');

const getAll = async () => (
    await executeQuery(`
        SELECT * FROM interests
        ORDER BY category, display_order ASC
    `)
);

const getByCategory = async (category) => (
    await executeQuery(`
        SELECT * FROM interests
        WHERE category = ?
        ORDER BY display_order ASC
    `, [category])
);

const getById = async (id) => (
    await executeQuerySingle(`
        SELECT * FROM interests
        WHERE id = ?
    `, [id])
);

module.exports = {
    getAll,
    getByCategory,
    getById
};
export {};
