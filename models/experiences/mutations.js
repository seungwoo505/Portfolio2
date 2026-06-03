const { executeQuery } = require('../db-utils');
const { getById } = require('./queries');
const {
    hasOwn,
    normalizeNullableValue
} = require('./mappers');

const allowedUpdateFields = [
    'type',
    'title',
    'company_or_institution',
    'location',
    'description',
    'start_date',
    'end_date',
    'is_current',
    'display_order'
];

const create = async (data) => {
    const {
        type,
        title,
        company_or_institution,
        location,
        description,
        start_date,
        end_date,
        is_current,
        display_order
    } = data;

    const params = [
        type,
        title,
        company_or_institution,
        location,
        description,
        start_date,
        end_date,
        is_current,
        display_order
    ].map(value => {
        if (value === undefined) return null;
        if (value === '') return null;
        return value;
    });

    const query = `
        INSERT INTO experiences (
            type,
            title,
            company_or_institution,
            location,
            description,
            start_date,
            end_date,
            is_current,
            display_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await executeQuery(query, params);
    return result.insertId;
};

const update = async (id, data) => {
    const updateFields = [];
    const updateValues = [];

    for (const field of allowedUpdateFields) {
        if (hasOwn(data, field) && data[field] !== undefined) {
            updateFields.push(`${field} = ?`);
            updateValues.push(normalizeNullableValue(data[field]));
        }
    }

    if (updateFields.length === 0) {
        return await getById(id);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    const query = `UPDATE experiences SET ${updateFields.join(', ')} WHERE id = ?`;
    await executeQuery(query, updateValues);
    return await getById(id);
};

const deleteExperience = async (id) => {
    await executeQuery('DELETE FROM experiences WHERE id = ?', [id]);
};

const updateDisplayOrder = async (id, displayOrder) => {
    await executeQuery(
        'UPDATE experiences SET display_order = ?, updated_at = NOW() WHERE id = ?',
        [displayOrder, id]
    );
};

module.exports = {
    allowedUpdateFields,
    create,
    delete: deleteExperience,
    update,
    updateDisplayOrder
};
