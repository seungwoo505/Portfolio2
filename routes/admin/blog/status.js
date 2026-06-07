const express = require('express');
const {
    authenticateToken,
    buildErrorLog,
    logActivity,
    logger,
    requirePermission
} = require('./common');
const { updateBlogPostStatusBySlug } = require('./status-update');

const router = express.Router();

const sendRouteError = (res, error) => (
    res.status(error.statusCode).json({
        success: false,
        message: error.message
    })
);

/**
 * @swagger
 * /admin/blog/posts/slug/{slug}/publish:
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
            const result = await updateBlogPostStatusBySlug({
                body: req.body,
                falseMessage: '포스트 발행이 취소되었습니다.',
                field: 'is_published',
                invalidMessage: '발행 상태는 boolean 값이어야 합니다.',
                slug: req.params.slug,
                trueMessage: '포스트가 발행되었습니다.'
            });
            if (result.error) {
                return sendRouteError(res, result.error);
            }

            res.json({
                success: true,
                message: result.message,
                data: result.data
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
 * /admin/blog/posts/slug/{slug}/featured:
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
            const result = await updateBlogPostStatusBySlug({
                body: req.body,
                falseMessage: '포스트 추천이 해제되었습니다.',
                field: 'is_featured',
                invalidMessage: '추천 상태는 boolean 값이어야 합니다.',
                slug: req.params.slug,
                trueMessage: '포스트가 추천되었습니다.'
            });
            if (result.error) {
                return sendRouteError(res, result.error);
            }

            res.json({
                success: true,
                message: result.message,
                data: result.data
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
