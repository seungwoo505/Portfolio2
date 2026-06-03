const { executeQuery, executeQuerySingle } = require('../db-utils');
const { createUniqueSlug } = require('../../utils/slug');
const { getById } = require('./queries');

const createTagSlug = async ({ name, slug, id = null }) => (
    await createUniqueSlug({
        value: name,
        providedSlug: slug,
        fallback: 'tag',
        maxLength: 120,
        exists: async candidate => {
            const query = id
                ? 'SELECT id FROM tags WHERE slug = ? AND id != ? LIMIT 1'
                : 'SELECT id FROM tags WHERE slug = ? LIMIT 1';
            const params = id ? [candidate, id] : [candidate];
            return !!(await executeQuerySingle(query, params));
        }
    })
);

const create = async (data) => {
    const { name, slug, description, color, type = 'general' } = data;
    const finalSlug = await createTagSlug({ name, slug });
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
};

const update = async (id, data) => {
    const { name, slug, description, color, type } = data;
    let finalSlug = null;

    if (slug !== undefined || name !== undefined) {
        finalSlug = await createTagSlug({ name, slug, id });
    }

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(name);
    }
    if (slug !== undefined || name !== undefined) {
        updateFields.push('slug = ?');
        updateValues.push(finalSlug);
    }
    if (description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(description);
    }
    if (color !== undefined) {
        updateFields.push('color = ?');
        updateValues.push(color);
    }
    if (type !== undefined) {
        updateFields.push('type = ?');
        updateValues.push(type);
    }

    if (updateFields.length === 0) {
        return await getById(id);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    const query = `UPDATE tags SET ${updateFields.join(', ')} WHERE id = ?`;
    await executeQuery(query, updateValues);
    return await getById(id);
};

const deleteTag = async (id) => {
    await executeQuery('DELETE FROM tag_usage WHERE tag_id = ?', [id]);
    await executeQuery('DELETE FROM tags WHERE id = ?', [id]);
};

module.exports = {
    create,
    createTagSlug,
    delete: deleteTag,
    update
};
