const {
    CacheUtils,
    executeQuery,
    executeQuerySingle
} = require('./common');
const {
    getRelatedProjects
} = require('./projects');

const getPostTags = async (postId) => {
    return await executeQuery(`
        SELECT t.* FROM tags t
        INNER JOIN tag_usage tu ON t.id = tu.tag_id
        WHERE tu.content_type = 'blog_post' AND tu.content_id = ?
    `, [postId]);
};

const mapPostDetail = async (post) => {
    const [tags, relatedProjects] = await Promise.all([
        getPostTags(post.id),
        getRelatedProjects(post.id)
    ]);
    return {
        ...post,
        featured: Boolean(post.is_featured),
        tags,
        related_projects: relatedProjects,
        projects: relatedProjects
    };
};

module.exports = {
    /**
     * @description 슬러그를 이용해 단일 블로그 글을 조회한다.
     * @param {string} slug 블로그 글 슬러그
     * @returns {Promise<Object|null>} 블로그 글 데이터 또는 null
     */
    async getBySlug(slug) {
        const cacheKey = CacheUtils.generateKey('blog_post', 'slug', slug);

        return await CacheUtils.cacheApiResponse(cacheKey, async () => {
            const post = await executeQuerySingle(`
                SELECT * FROM blog_posts WHERE slug = ? AND is_published = TRUE
            `, [slug]);

            if (!post) return null;

            return await mapPostDetail(post);
        }, 600);
    },

    /**
     * @description 관리자용으로 슬러그 기반 블로그 글을 조회한다.
     * @param {string} slug 블로그 글 슬러그
     * @returns {Promise<Object|null>} 블로그 글 데이터 또는 null
     */
    async getBySlugAdmin(slug) {
        const cacheKey = CacheUtils.generateKey('blog_post_admin', 'slug', slug);

        return await CacheUtils.cacheApiResponse(cacheKey, async () => {
            const post = await executeQuerySingle(`
                SELECT * FROM blog_posts WHERE slug = ?
            `, [slug]);

            if (!post) return null;

            return await mapPostDetail(post);
        }, 600);
    },

    /**
     * @description ID로 블로그 글을 조회한다.
     * @param {number} id 블로그 글 ID
     * @returns {Promise<Object|null>} 블로그 글 데이터 또는 null
     */
    async getById(id) {
        const post = await executeQuerySingle('SELECT * FROM blog_posts WHERE id = ?', [id]);

        if (!post) return null;

        return await mapPostDetail(post);
    },

    /**
     * @description UUID로 블로그 글을 조회한다.
     * @param {string} uuid 블로그 글 UUID
     * @returns {Promise<Object|null>} 블로그 글 데이터 또는 null
     */
    async getByUuid(uuid) {
        return await executeQuerySingle('SELECT * FROM blog_posts WHERE uuid = ?', [uuid]);
    },

    /**
     * @description 블로그 글 조회수를 1 증가시킨다.
     * @param {number} id 블로그 글 ID
     * @returns {Promise<void>}
     */
    async incrementView(id) {
        await executeQuery('UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?', [id]);
    }
};
export {};
