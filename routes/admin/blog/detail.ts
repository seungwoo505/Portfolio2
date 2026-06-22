import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    BlogPosts,
    authenticateToken,
    buildErrorLog,
    logActivity,
    logger,
    requirePermission
} = require('./common');
const {
    findBlogPostBySlug,
    parseBlogPostSlugParam
} = require('./lookup');
const { normalizeBlogUpdatePayload } = require('./payload');

const router: Router = express.Router();

type BlogRouteError = {
    statusCode: number;
    message: string;
};

const sendRouteError = (res: Response, error: BlogRouteError) => (
    res.status(error.statusCode).json({
        success: false,
        message: error.message
    })
);

/**
 * @swagger
 * /admin/blog/posts/slug/{slug}:
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
router.get('/blog/posts/slug/:slug', authenticateToken, requirePermission('blog.read'), async (req: Request, res: Response) => {
    try {
        const parsed = parseBlogPostSlugParam(req.params.slug);
        if (parsed.error) {
            return sendRouteError(res, parsed.error);
        }

        const lookup = await findBlogPostBySlug(parsed.postSlug);
        if (lookup.error) {
            return sendRouteError(res, lookup.error);
        }

        res.json({
            success: true,
            data: lookup.post
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
    async (req: Request, res: Response) => {
        try {
            const parsed = parseBlogPostSlugParam(req.params.slug);
            if (parsed.error) {
                return sendRouteError(res, parsed.error);
            }

            const payload = normalizeBlogUpdatePayload(req);
            if (payload.error) {
                return res.status(400).json({
                    success: false,
                    message: payload.error
                });
            }

            const lookup = await findBlogPostBySlug(parsed.postSlug);
            if (lookup.error) {
                return sendRouteError(res, lookup.error);
            }

            const updatedPost = await BlogPosts.update(lookup.post.id, payload.body);

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
    async (req: Request, res: Response) => {
        try {
            const parsed = parseBlogPostSlugParam(req.params.slug);
            if (parsed.error) {
                return sendRouteError(res, parsed.error);
            }

            const lookup = await findBlogPostBySlug(parsed.postSlug);
            if (lookup.error) {
                return sendRouteError(res, lookup.error);
            }

            await BlogPosts.delete(lookup.post.id);

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
