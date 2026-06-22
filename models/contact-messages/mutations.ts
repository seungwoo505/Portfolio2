const { executeQuery } = require('../db-utils');
const { getById } = require('./queries');

const create = async (data) => {
    const { name, email, subject, message, ip_address, user_agent } = data;
    const query = `
        INSERT INTO contact_messages (name, email, subject, message, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await executeQuery(query, [name, email, subject, message, ip_address, user_agent]);
    return result.insertId;
};

const markAsRead = async (id) => {
    await executeQuery('UPDATE contact_messages SET is_read = TRUE, read_at = NOW() WHERE id = ?', [id]);
    return await getById(id);
};

const markAsReplied = async (id) => {
    await executeQuery('UPDATE contact_messages SET is_replied = TRUE WHERE id = ?', [id]);
    return await getById(id);
};

const markMultipleAsRead = async (ids) => {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    await executeQuery(`UPDATE contact_messages SET is_read = TRUE, read_at = NOW() WHERE id IN (${placeholders})`, ids);
};

const deleteMessage = async (id) => {
    await executeQuery('DELETE FROM contact_messages WHERE id = ?', [id]);
};

const deleteMultiple = async (ids) => {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    await executeQuery(`DELETE FROM contact_messages WHERE id IN (${placeholders})`, ids);
};

module.exports = {
    create,
    delete: deleteMessage,
    deleteMultiple,
    markAsRead,
    markAsReplied,
    markMultipleAsRead
};
export {};
