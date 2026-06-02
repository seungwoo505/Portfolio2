const {
    CacheUtils,
    createUniqueSlug,
    defaultQueryContext,
    executeQuery,
    normalizeTagNames
} = require('./common');

module.exports = {
    /**
     * @description 블로그 글과 태그의 관계를 갱신한다.
     * @param {number} postId 블로그 글 ID
     * @param {Array<string>} tagNames 태그 이름 목록
     * @returns {Promise<void>}
     */
    async updateTags(postId, tagNames, db = defaultQueryContext) {
        await db.query("DELETE FROM tag_usage WHERE content_type = 'blog_post' AND content_id = ?", [postId]);

        const tagArray = normalizeTagNames(tagNames);

        for (const tagName of tagArray) {
            const trimmed = String(tagName).trim();
            if (!trimmed) continue;

            let tag = await db.querySingle('SELECT id FROM tags WHERE name = ?', [trimmed]);

            if (!tag) {
                const tagSlug = await createUniqueSlug({
                    value: trimmed,
                    fallback: 'tag',
                    maxLength: 120,
                    exists: async candidate => !!(await db.querySingle(
                        'SELECT id FROM tags WHERE slug = ? LIMIT 1',
                        [candidate]
                    ))
                });
                const result = await db.query("INSERT INTO tags (name, slug, type) VALUES (?, ?, 'blog')", [trimmed, tagSlug]);
                tag = { id: result.insertId };
            }

            await db.query("INSERT IGNORE INTO tag_usage (tag_id, content_type, content_id) VALUES (?, 'blog_post', ?)", [tag.id, postId]);
        }

        await db.query('UPDATE tags t LEFT JOIN (SELECT tag_id, COUNT(*) cnt FROM tag_usage GROUP BY tag_id) u ON t.id = u.tag_id SET t.usage_count = COALESCE(u.cnt, 0)');
    },

    /**
     * @description 태그별 사용량을 재계산한다.
     * @returns {Promise<void>}
     */
    async updateTagCounts() {
        await executeQuery('UPDATE tags t LEFT JOIN (SELECT tag_id, COUNT(*) cnt FROM tag_usage GROUP BY tag_id) u ON t.id = u.tag_id SET t.usage_count = COALESCE(u.cnt, 0)');
    },

    /**
     * @description 블로그 관련 캐시 키를 무효화한다.
     * @returns {void}
     */
    invalidateCache() {
        CacheUtils.invalidateResources('blog', 'tags');
    }
};
