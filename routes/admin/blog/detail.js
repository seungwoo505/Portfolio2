const express = require('express');
const {
    BlogPosts,
    authenticateToken,
    buildErrorLog,
    getPlainBody,
    hasInvalidProvidedStringFields,
    logActivity,
    logger,
    parseSlugParam,
    requirePermission,
    trimStringFields
} = require('./common');

const router = express.Router();

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
 *       400:
 *         description: 잘못된 slug
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
 *       400:
 *         description: 잘못된 요청 또는 slug
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
 *       400:
 *         description: 잘못된 slug
 *       404:
 *         description: 포스트 없음
 */
router.get('/blog/posts/slug/:slug', authenticateToken, requirePermission('blog.read'), async (req, res) => {
    try {
        const postSlug = parseSlugParam(req.params.slug);
        if (!postSlug) {
            return res.status(400).json({
                success: false,
                message: '유효한 slug가 필요합니다.'
            });
        }

        const post = await BlogPosts.getBySlugAdmin(postSlug);

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
            const postSlug = parseSlugParam(req.params.slug);
            if (!postSlug) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 slug가 필요합니다.'
                });
            }
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

router.delete('/blog/posts/slug/:slug',
    authenticateToken,
    requirePermission('blog.delete'),
    logActivity('delete_blog_post'),
    async (req, res) => {
        try {
            const postSlug = parseSlugParam(req.params.slug);
            if (!postSlug) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 slug가 필요합니다.'
                });
            }

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
