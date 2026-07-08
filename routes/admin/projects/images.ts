import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    CacheUtils,
    Projects,
    authenticateToken,
    buildErrorLog,
    getPlainBody,
    logActivity,
    logger,
    parseImagesPayload,
    parseSlugParam,
    requirePermission
} = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /admin/projects/slug/{slug}/images:
 *   get:
 *     summary: 프로젝트 이미지 목록 조회
 *     tags: ['Admin - Projects']
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
 *         description: 프로젝트 이미지 목록 조회 성공
 *   put:
 *     summary: 프로젝트 이미지 목록 전체 교체
 *     tags: ['Admin - Projects']
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
 *             required:
 *               - images
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - image_url
 *                   properties:
 *                     image_type:
 *                       type: string
 *                       enum: [catalog, cover, gallery, detail, og]
 *                     image_url:
 *                       type: string
 *                     alt_text:
 *                       type: string
 *                     caption:
 *                       type: string
 *                     width:
 *                       type: integer
 *                     height:
 *                       type: integer
 *                     display_order:
 *                       type: integer
 *                     is_primary:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: 프로젝트 이미지 목록 교체 성공
 */
router.get('/projects/slug/:slug/images',
    authenticateToken,
    requirePermission('projects.read'),
    async (req: Request, res: Response) => {
        try {
            const projectSlug = parseSlugParam(req.params.slug);
            if (!projectSlug) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 slug가 필요합니다.'
                });
            }

            const project = await Projects.getBySlug(projectSlug);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: '프로젝트를 찾을 수 없습니다.'
                });
            }

            res.json({
                success: true,
                data: project.images || []
            });
        } catch (error) {
            logger.error('프로젝트 이미지 목록 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '프로젝트 이미지를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.put('/projects/slug/:slug/images',
    authenticateToken,
    requirePermission('projects.update'),
    logActivity('update_project_images'),
    async (req: Request, res: Response) => {
        try {
            const projectSlug = parseSlugParam(req.params.slug);
            if (!projectSlug) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 slug가 필요합니다.'
                });
            }

            const project = await Projects.getBySlug(projectSlug);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: '프로젝트를 찾을 수 없습니다.'
                });
            }

            const parsed = parseImagesPayload(getPlainBody(req));
            if (parsed.error) {
                return res.status(400).json({
                    success: false,
                    message: parsed.error
                });
            }

            const updatedProject = await Projects.update(project.id, {
                images: parsed.images
            });
            CacheUtils.invalidateResources('projects');

            res.json({
                success: true,
                message: '프로젝트 이미지가 수정되었습니다.',
                data: updatedProject.images || []
            });
        } catch (error) {
            logger.error('프로젝트 이미지 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '프로젝트 이미지 수정에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
