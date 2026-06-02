const { executeQuery } = require('./common');

module.exports = {
    /**
     * @description 검색어를 기준으로 블로그 글을 찾는다.
     * @param {string} query 검색어
     * @param {number} [limit=10] 최대 조회 개수
     * @returns {Promise<Array>} 검색 결과 목록
     */
    async search(query, limit = 10) {
        const searchQuery = `
            SELECT bp.*,
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags,
                   MATCH(bp.title, bp.content) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
            FROM blog_posts bp
            LEFT JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
            LEFT JOIN tags t ON tu.tag_id = t.id
            WHERE bp.is_published = TRUE AND (
                MATCH(bp.title, bp.content) AGAINST(? IN NATURAL LANGUAGE MODE) OR
                bp.title LIKE ? OR
                bp.content LIKE ? OR
                t.name LIKE ?
            )
            GROUP BY bp.id
            ORDER BY relevance DESC, bp.published_at DESC
            LIMIT ?
        `;

        const searchTerm = `%${query}%`;
        const posts = await executeQuery(searchQuery, [query, query, searchTerm, searchTerm, searchTerm, limit]);

        return posts.map(post => ({
            ...post,
            tags: post.tags ? post.tags.split(',') : []
        }));
    },

    /**
     * @description 태그 슬러그로 블로그 글을 조회한다.
     * @param {string} tagSlug 태그 슬러그
     * @param {number} [limit=10] 최대 조회 개수
     * @param {number} [offset=0] 시작 오프셋
     * @returns {Promise<Array>} 태그에 해당하는 블로그 글 목록
     */
    async getByTag(tagSlug, limit = 10, offset = 0) {
        const query = `
            SELECT bp.*,
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags
            FROM blog_posts bp
            INNER JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
            INNER JOIN tags t ON tu.tag_id = t.id
            WHERE t.slug = ? AND bp.is_published = TRUE
            GROUP BY bp.id
            ORDER BY bp.published_at DESC
            LIMIT ? OFFSET ?
        `;

        const posts = await executeQuery(query, [tagSlug, limit, offset]);
        return posts.map(post => ({
            ...post,
            tags: post.tags ? post.tags.split(',') : []
        }));
    }
};
