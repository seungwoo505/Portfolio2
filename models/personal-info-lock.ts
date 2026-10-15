// 개인 정보가 비어 있어도 여러 프로세스가 하나의 최신 행을 갱신하도록 직렬화한다.
const LOCK_NAME = 'portfolio:personal-info:write';

const withPersonalInfoWriteLock = async (callback) => {
    const pool = require('../db');
    const connection = await pool.getConnection();
    let acquired = false;
    let reusable = false;

    try {
        const [rows] = await connection.execute('SELECT GET_LOCK(?, 5) AS acquired', [LOCK_NAME]);
        const result = rows[0]?.acquired == null ? null : Number(rows[0].acquired);
        acquired = result === 1;
        reusable = result === 0;
        if (!acquired) throw new Error('개인 정보 저장 잠금을 획득하지 못했습니다.');
        return await callback(connection);
    } finally {
        if (acquired) {
            try {
                const [rows] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [LOCK_NAME]);
                reusable = Number(rows[0]?.released) === 1;
            } catch {
                reusable = false;
            }
        }
        // 응답 유실 등으로 잠금 상태가 불확실하면 연결을 폐기해 풀에 남기지 않는다.
        if (reusable) connection.release();
        else connection.destroy();
    }
};

module.exports = { withPersonalInfoWriteLock };
export {};
