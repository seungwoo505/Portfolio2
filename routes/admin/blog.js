const express = require('express');
const router = express.Router();
const { logger, buildErrorLog } = require('./common');
const BlogPosts = require('../../models/blog-posts');
const CacheUtils = require('../../utils/cache');
const { parsePagination } = require('../../utils/pagination');
const { toBooleanOrNull } = require('../../utils/filter-values');
const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../utils/request-body');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');

/**
 * @swagger
 * /api/admin/blog/posts:
 *   get:
 *     summary: 관리자 블로그 포스트 목록 조회
 *     tags: ['Admin - Blog']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: 포스트 목록 조회 성공
 *       500:
 *         description: 서버 오류
 *   post:
 *     summary: 블로그 포스트 생성
 *     tags: ['Admin - Blog']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: 포스트 생성 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.get('/blog/posts', authenticateToken, requirePermission('blog.read'), async (req, res) => {
    try {
        const { limit, page, offset } = parsePagination(req.query, {
            defaultLimit: 20,
            maxLimit: 100
        });

        const [posts, total] = await Promise.all([
            BlogPosts.getAll(limit, offset, false),
            BlogPosts.getCountWithFilters({
                status: 'all',
                published_only: false
            })
        ]);

        res.json({
            success: true,
            data: posts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '블로그 포스트를 가져오는데 실패했습니다.'
        });
    }
});

router.post('/blog/posts',
    authenticateToken,
    requirePermission('blog.create'),
    logActivity('create_blog_post'),
    async (req, res) => {
        try {
            const body = trimStringFields(getPlainBody(req), ['title', 'content']);

            if (!hasRequiredStringFields(body, ['title', 'content'])) {
                return res.status(400).json({
                    success: false,
                    message: '제목과 내용은 필수입니다.'
                });
            }

            const id = await BlogPosts.create(body);
            const newPost = await BlogPosts.getById(id);
            CacheUtils.invalidateResources('blog');

            res.status(201).json({
                success: true,
                message: '블로그 포스트가 생성되었습니다.',
                data: newPost
            });
        } catch (error) {
            logger.error('블로그 포스트 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '블로그 포스트 생성에 실패했습니다.'
            });
        }
    }
);

/**
 * @swagger
 * /api/admin/blog/posts/slug/{slug}:
 *   get:
 *     summary: 블로그 포스트 상세 조회 (관리자)
 *     tags: ['Admin - Blog']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 포스트 조회 성공
 *       404:
 *         description: 포스트 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     summary: 블로그 포스트 수정
 *     tags: ['Admin - Blog']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: 포스트 수정 성공
 *       404:
 *         description: 포스트 없음
 *   delete:
 *     summary: 블로그 포스트 삭제
 *     tags: ['Admin - Blog']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 포스트 삭제 성공
 *       404:
 *         description: 포스트 없음
 */
router.get('/blog/posts/slug/:slug', authenticateToken, requirePermission('blog.read'), async (req, res) => {
    try {
        const post = await BlogPosts.getBySlugAdmin(req.params.slug);

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '포스트를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: post
        });
    } catch (error) {
        logger.error('블로그 포스트 조회 실패', buildErrorLog(error, req));
        res.status(500).json({
            success: false,
            message: '포스트 정보를 가져오는데 실패했습니다.'
        });
    }
});

router.put('/blog/posts/slug/:slug',
    authenticateToken,
    requirePermission('blog.update'),
    logActivity('update_blog_post'),
    async (req, res) => {
        try {
            const postSlug = req.params.slug;
            const body = trimStringFields(getPlainBody(req), ['title', 'content']);

            if (Object.keys(body).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '수정할 블로그 포스트 정보가 필요합니다.'
                });
            }

            if (hasInvalidProvidedStringFields(body, ['title', 'content'])) {
                return res.status(400).json({
                    success: false,
                    message: '제목과 내용은 비어 있을 수 없습니다.'
                });
            }

            const existingPost = await BlogPosts.getBySlugAdmin(postSlug);
            if (!existingPost) {
                return res.status(404).json({
                    success: false,
                    message: '포스트를 찾을 수 없습니다.'
                });
            }

            const updatedPost = await BlogPosts.update(existingPost.id, body);

            res.json({
                success: true,
                message: '블로그 포스트가 수정되었습니다.',
                data: updatedPost
            });
        } catch (error) {
            logger.error('블로그 포스트 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '블로그 포스트 수정에 실패했습니다.'
            });
        }
    }
);

/**
 * @swagger
 * /api/admin/blog/posts/slug/{slug}/publish:
 *   put:
 *     summary: 블로그 포스트 발행 상태 변경
 *     tags: ['Admin - Blog']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_published:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: 발행 상태 변경 성공
 *       404:
 *         description: 포스트 없음
 */
router.put('/blog/posts/slug/:slug/publish',
    authenticateToken,
    requirePermission('blog.publish'),
    logActivity('publish_blog_post'),
    async (req, res) => {
        try {
            const isPublished = toBooleanOrNull(req.body?.is_published);
            if (isPublished === null) {
                return res.status(400).json({
                    success: false,
                    message: '발행 상태는 boolean 값이어야 합니다.'
                });
            }
            const postSlug = req.params.slug;

            const existingPost = await BlogPosts.getBySlugAdmin(postSlug);
            if (!existingPost) {
                return res.status(404).json({
                    success: false,
                    message: '포스트를 찾을 수 없습니다.'
                });
            }

            const updatedPost = await BlogPosts.update(existingPost.id, {
                is_published: isPublished
            });

            res.json({
                success: true,
                message: isPublished ? '포스트가 발행되었습니다.' : '포스트 발행이 취소되었습니다.',
                data: updatedPost
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '포스트 발행 상태 변경에 실패했습니다.'
            });
        }
    }
);

/**
 * @swagger
 * /api/admin/blog/posts/slug/{slug}/featured:
 *   put:
 *     summary: 블로그 포스트 추천 상태 변경
 *     tags: ['Admin - Blog']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_featured:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: 추천 상태 변경 성공
 *       404:
 *         description: 포스트 없음
 */
router.put('/blog/posts/slug/:slug/featured',
    authenticateToken,
    requirePermission('blog.edit'),
    logActivity('feature_blog_post'),
    async (req, res) => {
        try {
            const isFeatured = toBooleanOrNull(req.body?.is_featured);
            if (isFeatured === null) {
                return res.status(400).json({
                    success: false,
                    message: '추천 상태는 boolean 값이어야 합니다.'
                });
            }
            const postSlug = req.params.slug;

            const existingPost = await BlogPosts.getBySlugAdmin(postSlug);
            if (!existingPost) {
                return res.status(404).json({
                    success: false,
                    message: '포스트를 찾을 수 없습니다.'
                });
            }

            const updatedPost = await BlogPosts.update(existingPost.id, {
                is_featured: isFeatured
            });

            res.json({
                success: true,
                message: isFeatured ? '포스트가 추천되었습니다.' : '포스트 추천이 해제되었습니다.',
                data: updatedPost
            });
        } catch (error) {
            logger.error('블로그 포스트 추천 상태 변경 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '포스트 추천 상태 변경에 실패했습니다.'
            });
        }
    }
);

router.delete('/blog/posts/slug/:slug',
    authenticateToken,
    requirePermission('blog.delete'),
    logActivity('delete_blog_post'),
    async (req, res) => {
        try {
            const postSlug = req.params.slug;

            const post = await BlogPosts.getBySlugAdmin(postSlug);
            if (!post) {
                return res.status(404).json({
                    success: false,
                    message: '포스트를 찾을 수 없습니다.'
                });
            }

            await BlogPosts.delete(post.id);

            res.json({
                success: true,
                message: '블로그 포스트가 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('블로그 포스트 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '블로그 포스트 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
