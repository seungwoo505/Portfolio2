// DB 서버 잠금으로 여러 PM2 프로세스의 스킬 쓰기와 카테고리 삭제를 직렬화한다.
const WRITE_LOCK_NAME = 'portfolio:skills:featured-display-order';

const withSkillWriteLock = async (callback) => {
    const db = require('../../db');
    const connection = await db.getConnection();
    let acquired = false;
    let reusable = false;
    try {
        const [rows] = await connection.execute('SELECT GET_LOCK(?, 5) AS acquired', [WRITE_LOCK_NAME]);
        const result = rows[0]?.acquired == null ? null : Number(rows[0].acquired);
        acquired = result === 1;
        reusable = result === 0;
        if (!acquired) {
            throw new Error('기술 스택 저장 잠금을 획득하지 못했습니다.');
        }

        // 검사와 자동 커밋되는 쓰기를 같은 커넥션에서 끝낸 뒤 잠금을 해제한다.
        return await callback(connection);
    } finally {
        if (acquired) {
            try {
                const [rows] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [WRITE_LOCK_NAME]);
                reusable = Number(rows[0]?.released) === 1;
            } catch {
                reusable = false;
            }
        }
        // 획득/해제 응답이 유실된 연결은 폐기하여 잠금을 풀에 남기지 않는다.
        if (reusable) connection.release();
        else connection.destroy();
    }
};

const assertFeaturedDisplayOrderAvailable = async (connection, data, excludeId = null) => {
    const displayOrder = Number(data.display_order);
    if (Number(data.is_featured) !== 1 || !(displayOrder > 0)) return;

    let query = 'SELECT id FROM skills WHERE display_order = ? AND is_featured = TRUE';
    const values = [displayOrder];
    if (excludeId !== null) {
        query += ' AND id != ?';
        values.push(excludeId);
    }
    query += ' LIMIT 1';
    const [rows] = await connection.execute(query, values);
    if (rows.length > 0) {
        throw Object.assign(new Error('추천 스킬 표시 순서가 중복됩니다.'), {
            code: 'SKILL_DISPLAY_ORDER_CONFLICT',
            displayOrder
        });
    }
};

const assertSkillCategoryExists = async (connection, categoryId) => {
    if (categoryId == null) return;
    const [rows] = await connection.execute('SELECT id FROM skill_categories WHERE id = ?', [categoryId]);
    if (!rows[0]) {
        throw Object.assign(new Error('유효한 카테고리를 선택해주세요.'), { code: 'SKILL_CATEGORY_NOT_FOUND' });
    }
};

module.exports = { assertFeaturedDisplayOrderAvailable, assertSkillCategoryExists, withSkillWriteLock };
export {};
