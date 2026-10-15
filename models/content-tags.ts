// 태그 이름은 쉼표를 포함할 수 있으므로 문자열 집계 없이 관계 행을 읽는다.
// 목록 전체에 한 번 조회하여 GROUP_CONCAT 길이 제한과 항목별 추가 조회를 피한다.
const withContentTags = async (items, contentType, query) => {
    if (items.length === 0) return [];

    const ids = [...new Set(items.map(item => item.id))];
    const placeholders = ids.map(() => '?').join(',');
    const rows = await query(`
        SELECT DISTINCT tu.content_id, t.name
        FROM tag_usage tu
        INNER JOIN tags t ON t.id = tu.tag_id
        WHERE tu.content_type = ? AND tu.content_id IN (${placeholders})
        ORDER BY t.name ASC
    `, [contentType, ...ids]);
    const namesById = new Map();
    for (const row of rows) {
        if (!namesById.has(row.content_id)) namesById.set(row.content_id, []);
        namesById.get(row.content_id).push(row.name);
    }

    return items.map(item => ({ ...item, tags: namesById.get(item.id) || [] }));
};

module.exports = { withContentTags };
export {};
