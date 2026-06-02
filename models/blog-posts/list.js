const {
    CacheUtils,
    executeQuery,
    executeQuerySingle,
    mapBlogPostListItem
} = require('./common');
const {
    appendBlogFilterConditions,
    buildBlogOrderClause,
    normalizeBlogFilters
} = require('./filters');

module.exports = {
    /**
     * @description 블로그 글 목록을 캐시를 활용해 조회한다.
     * @param {number} [limit=10] 최대 조회 개수
     * @param {number} [offset=0] 시작 오프셋
     * @param {boolean} [published_only=true] 게시된 글만 가져올지 여부
     * @returns {Promise<Array>} 블로그 글 목록
     */
    async getAll(limit = 10, offset = 0, published_only = true) {
        const cacheKey = CacheUtils.generateKey('blog_posts', 'all', limit, offset, published_only);

        return await CacheUtils.cacheApiResponse(cacheKey, async () => {
            const whereClause = published_only ? 'WHERE bp.is_published = TRUE' : '';

            const query = `
                SELECT bp.*,
                       GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags
                FROM blog_posts bp
                LEFT JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
                LEFT JOIN tags t ON tu.tag_id = t.id
                ${whereClause}
                GROUP BY bp.id
                ORDER BY bp.is_featured DESC, bp.published_at DESC, bp.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const posts = await executeQuery(query, [limit, offset]);
            return posts.map(mapBlogPostListItem);
        }, 300);
    },

    /**
     * @description 검색어, 태그, 정렬 조건 등을 이용해 블로그 글을 조회한다.
     * @param {Object} filters 필터 옵션
     * @returns {Promise<Array>} 필터링된 블로그 글 목록
     */
    async getWithFilters(filters = {}) {
        const normalizedFilters = normalizeBlogFilters(filters);
        const { queryParams, whereClause } = appendBlogFilterConditions(normalizedFilters);
        const orderClause = buildBlogOrderClause(normalizedFilters);

        const query = `
            SELECT bp.*,
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags
            FROM blog_posts bp
            LEFT JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
            LEFT JOIN tags t ON tu.tag_id = t.id
            ${whereClause}
            GROUP BY bp.id
            ${orderClause}
            LIMIT ? OFFSET ?
        `;

        queryParams.push(normalizedFilters.limit, normalizedFilters.offset);
        const posts = await executeQuery(query, queryParams);

        return posts.map(mapBlogPostListItem);
    },

    /**
     * @description 필터 조건에 맞는 블로그 글 개수를 반환한다.
     * @param {Object} filters 필터 옵션
     * @returns {Promise<number>} 조건에 해당하는 글 수
     */
    async getCountWithFilters(filters = {}) {
        const normalizedFilters = normalizeBlogFilters(filters);
        const { queryParams, whereClause } = appendBlogFilterConditions(normalizedFilters);

        const query = `
            SELECT COUNT(DISTINCT bp.id) as total
            FROM blog_posts bp
            LEFT JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
            LEFT JOIN tags t ON tu.tag_id = t.id
            ${whereClause}
        `;

        const result = await executeQuerySingle(query, queryParams);
        return result.total || 0;
    },

    /**
     * @description 추천 블로그 글을 조회한다.
     * @param {number} [limit=5] 최대 조회 개수
     * @param {number} [offset=0] 시작 오프셋
     * @returns {Promise<Array>} 추천 블로그 글 목록
     */
    async getFeatured(limit = 5, offset = 0) {
        const cacheKey = CacheUtils.generateKey('blog_posts', 'featured', limit, offset);

        return await CacheUtils.cacheApiResponse(cacheKey, async () => {
            const posts = await executeQuery(`
                SELECT bp.*,
                       GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags
                FROM blog_posts bp
                LEFT JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
                LEFT JOIN tags t ON tu.tag_id = t.id
                WHERE bp.is_published = TRUE AND bp.is_featured = TRUE
                GROUP BY bp.id
                ORDER BY bp.published_at DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);

            return posts.map(mapBlogPostListItem);
        }, 300);
    }
};
