const express = require('express');
const {
    BlogPosts,
    CacheUtils,
    authenticateToken,
    buildErrorLog,
    getPlainBody,
    hasRequiredStringFields,
    logActivity,
    logger,
    parsePagination,
    requirePermission,
    trimStringFields
} = require('./common');

const router = express.Router();

/**
 * @swagger
 * /admin/blog/posts:
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

module.exports = router;
