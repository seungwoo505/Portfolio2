const { executeQuery } = require('../db-utils');
const { getById } = require('./queries');

const create = async (data) => {
    const { title, description, icon, category, display_order } = data;
    const query = `
        INSERT INTO interests (title, description, icon, category, display_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const result = await executeQuery(query, [title, description, icon, category, display_order]);
    return await getById(result.insertId);
};

const update = async (id, data) => {
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
        return await getById(id);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    const query = `UPDATE interests SET ${updateFields.join(', ')} WHERE id = ?`;
    await executeQuery(query, updateValues);
    return await getById(id);
};

const deleteInterest = async (id) => {
    await executeQuery('DELETE FROM interests WHERE id = ?', [id]);
    return { success: true };
};

const updateOrder = async (id, display_order) => {
    const query = `
        UPDATE interests
        SET display_order = ?, updated_at = NOW()
        WHERE id = ?
    `;
    await executeQuery(query, [display_order, id]);
    return await getById(id);
};

module.exports = {
    create,
    delete: deleteInterest,
    update,
    updateOrder
};
