const express = require('express');
const BlogPosts = require('../../models/blog-posts');
const { isValidSlug } = require('../../utils/slug');
const {
    CacheUtils,
    badRequest,
    buildPaginationMeta,
    buildPostFilters,
    cacheKey,
    fail,
    incrementViewOnce,
    loadCachedPaginatedResource,
    loadCachedSlugResource,
    notFound,
    ok
} = require('./common');

const router = express.Router();

/**
 * @swagger
 * /api/public/posts:
 *   get:
 *     summary: 공개 블로그 글 목록 조회
 *     tags: ['Public']
 * /api/public/posts/tag/{tagSlug}:
 *   get:
 *     summary: 태그별 공개 블로그 글 목록 조회
 *     tags: ['Public']
 * /api/public/posts/{slug}:
 *   get:
 *     summary: 공개 블로그 글 상세 조회
 *     tags: ['Public']
 * /api/public/posts/{slug}/view:
 *   post:
 *     summary: 블로그 글 조회수 증가
 *     tags: ['Public']
 */
router.get('/posts', async (req, res) => {
    try {
        const filters = buildPostFilters(req.query);
        if (filters.error) {
            return badRequest(res, filters.error);
        }
        const data = await loadCachedPaginatedResource({
            cachePrefix: 'blog_posts',
            filters,
            loadItems: () => BlogPosts.getWithFilters(filters),
            loadTotal: () => BlogPosts.getCountWithFilters(filters)
        });

        return ok(res, data.items, {
            pagination: buildPaginationMeta(filters, data.total)
        });
    } catch (error) {
        return fail(res, error, req, '블로그 글 목록을 가져오는데 실패했습니다.');
    }
});

router.get('/posts/tag/:tagSlug', async (req, res) => {
    try {
        const { tagSlug } = req.params;
        if (!isValidSlug(tagSlug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const filters = buildPostFilters({
            ...req.query,
            tags: tagSlug
        });
        if (filters.error) {
            return badRequest(res, filters.error);
        }

        const data = await loadCachedPaginatedResource({
            cachePrefix: 'blog_posts',
            cacheParts: ['tag', tagSlug],
            filters,
            loadItems: () => BlogPosts.getWithFilters(filters),
            loadTotal: () => BlogPosts.getCountWithFilters(filters)
        });

        return ok(res, data.items, {
            pagination: buildPaginationMeta(filters, data.total)
        });
    } catch (error) {
        return fail(res, error, req, '태그별 블로그 글 목록을 가져오는데 실패했습니다.');
    }
});

router.post('/posts/:slug/view', async (req, res) => {
    try {
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const post = await BlogPosts.getBySlug(slug);
        if (!post) {
            return notFound(res, '블로그 글을 찾을 수 없습니다.');
        }

        await incrementViewOnce({
            resourceType: 'post',
            slug,
            req,
            increment: () => BlogPosts.incrementView(post.id),
            invalidate: () => {
                CacheUtils.del(cacheKey('blog_post', 'slug', slug));
                CacheUtils.delPattern('blog_posts:public:');
            }
        });

        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            success: true,
            message: '조회수가 증가되었습니다.'
        });
    } catch (error) {
        return fail(res, error, req, '블로그 조회수 증가에 실패했습니다.');
    }
});

router.get('/posts/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const data = await loadCachedSlugResource({
            cachePrefix: 'blog_post',
            slug,
            loadResource: () => BlogPosts.getBySlug(slug)
        });

        if (!data) {
            return notFound(res, '블로그 글을 찾을 수 없습니다.');
        }

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '블로그 글 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
