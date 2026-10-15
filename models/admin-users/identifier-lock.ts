// 사용자명과 이메일이 같은 로그인 공간을 쓰므로 모든 생성/식별자 수정을 직렬화한다.
const IDENTIFIER_LOCK_NAME = 'portfolio:admin-users:login-identifiers';

const withIdentifierWriteTransaction = async (callback) => {
    const pool = require('../../db');
    const connection = await pool.getConnection();
    let acquired = false;
    let reusable = false;
    let discard = false;

    try {
        const [rows] = await connection.execute('SELECT GET_LOCK(?, 5) AS acquired', [IDENTIFIER_LOCK_NAME]);
        const lockResult = rows[0]?.acquired == null ? null : Number(rows[0].acquired);
        acquired = lockResult === 1;
        reusable = lockResult === 0;
        if (!acquired) throw new Error('관리자 식별자 저장 잠금을 획득하지 못했습니다.');

        // 잠금을 얻은 뒤 트랜잭션을 시작하여 이전 작성자의 커밋을 검사에 반영한다.
        try {
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            try {
                await connection.rollback();
            } catch {
                // 롤백 오류로 원래 저장 오류를 덮거나 불확실한 연결을 재사용하지 않는다.
                discard = true;
            }
            throw error;
        }
    } finally {
        if (acquired) {
            try {
                const [rows] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [IDENTIFIER_LOCK_NAME]);
                reusable = Number(rows[0]?.released) === 1 && !discard;
            } catch {
                reusable = false;
            }
        }
        // 획득/해제 응답이 유실되었으면 연결을 닫아 세션 잠금을 풀에 남기지 않는다.
        if (reusable) connection.release();
        else connection.destroy();
    }
};

const assertIdentifiersAvailable = async (db, username, email, excludeId = null) => {
    let query = `
        SELECT id FROM admin_users
        WHERE (username IN (?, ?) OR email IN (?, ?))
    `;
    const params = [username, email, username, email];
    if (excludeId !== null) {
        query += ' AND id <> ?';
        params.push(excludeId);
    }
    const existing = await db.querySingle(query + ' LIMIT 1', params);
    if (existing) throw new Error('이미 존재하는 사용자명 또는 이메일입니다.');
};

module.exports = { assertIdentifiersAvailable, withIdentifierWriteTransaction };
export {};
