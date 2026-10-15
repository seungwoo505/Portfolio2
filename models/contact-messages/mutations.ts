const { executeQuery } = require('../db-utils');
const { getById } = require('./queries');
const crypto = require('crypto');

const insertMessage = async (data, queryRunner = executeQuery) => {
    const { name, email, subject, message, ip_address = null, user_agent = null } = data;
    const query = `
        INSERT INTO contact_messages (name, email, subject, message, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await queryRunner(query, [name, email, subject, message, ip_address, user_agent]);
    return result.insertId;
};

const create = async (data) => insertMessage(data);

const quotaError = () => Object.assign(new Error('문의 요청 한도를 초과했습니다.'), {
    code: 'CONTACT_RATE_LIMIT_EXCEEDED'
});

const createWithRateLimit = async (data, { max, windowHours }) => {
    if (!Number.isInteger(max) || max < 1 || !Number.isFinite(windowHours) || windowHours <= 0) {
        throw new Error('문의 요청 한도 설정이 유효하지 않습니다.');
    }
    const db = require('../../db');
    // DB 서버의 잠금이므로 PM2 등 서로 다른 프로세스에서도 같은 IP를 직렬화한다.
    const lockKey = 'contact:' + crypto.createHash('sha256')
        .update(JSON.stringify([process.env.DB_SCHEMA || '', String(data.ip_address || '').toLowerCase()]))
        .digest('hex').slice(0, 56);
    const connection = await db.getConnection();
    let acquired = false;
    let reusable = false;
    try {
        const [locks] = await connection.execute('SELECT GET_LOCK(?, 1) AS acquired', [lockKey]);
        reusable = true;
        const lockResult = locks[0]?.acquired == null ? null : Number(locks[0].acquired);
        acquired = lockResult === 1;
        if (!acquired) {
            if (lockResult === 0) throw quotaError();
            throw new Error('문의 요청 잠금을 획득하지 못했습니다.');
        }
        const [rows] = await connection.execute(`
            SELECT COUNT(*) AS total FROM contact_messages
            WHERE ip_address = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        `, [data.ip_address ?? null, windowHours]);
        if (Number(rows[0]?.total || 0) >= max) throw quotaError();

        // 이 커넥션의 자동 커밋이 끝날 때까지 잠금을 유지한다.
        return await insertMessage(data, async (query, params) => {
            const [result] = await connection.execute(query, params);
            return result;
        });
    } finally {
        if (acquired) {
            try {
                const [result] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [lockKey]);
                reusable = Number(result[0]?.released) === 1;
            } catch {
                reusable = false;
            }
        }
        // 잠금 상태가 불명확한 커넥션을 풀에 반환하면 후속 요청을 막을 수 있다.
        if (reusable) connection.release();
        else connection.destroy();
    }
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
    createWithRateLimit,
    delete: deleteMessage,
    deleteMultiple,
    markAsRead,
    markAsReplied,
    markMultipleAsRead
};
export {};
