const express = require('express');
const {
    BlogPosts,
    authenticateToken,
    buildErrorLog,
    logActivity,
    logger,
    parseSlugParam,
    requirePermission,
    toBooleanOrNull
} = require('./common');

const router = express.Router();

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
 *       400:
 *         description: 잘못된 요청 또는 slug
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
            const postSlug = parseSlugParam(req.params.slug);
            if (!postSlug) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 slug가 필요합니다.'
                });
            }

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
 *       400:
 *         description: 잘못된 요청 또는 slug
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
            const postSlug = parseSlugParam(req.params.slug);
            if (!postSlug) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 slug가 필요합니다.'
                });
            }

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

module.exports = router;
