const express = require('express');
const {
    CacheUtils,
    Projects,
    authenticateToken,
    buildErrorLog,
    logActivity,
    logger,
    parseSlugParam,
    requirePermission
} = require('./common');
const { parseProjectUpdateRequest, updateProjectBySlug } = require('./update');

const router = express.Router();

/**
 * @swagger
 * /admin/projects/slug/{slug}:
 *   get:
 *     summary: 프로젝트 상세 조회 (관리자)
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
 *         description: 프로젝트 조회 성공
 *       400:
 *         description: 잘못된 slug
 *       404:
 *         description: 프로젝트 없음
 *   put:
 *     summary: 프로젝트 수정
 *     tags: ['Admin - Projects']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 프로젝트 수정 성공
 *       400:
 *         description: 잘못된 요청 또는 slug
 *       404:
 *         description: 프로젝트 없음
 *   delete:
 *     summary: 프로젝트 삭제
 *     tags: ['Admin - Projects']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 프로젝트 삭제 성공
 *       400:
 *         description: 잘못된 slug
 *       404:
 *         description: 프로젝트 없음
 */
router.get('/projects/slug/:slug', authenticateToken, requirePermission('projects.read'), async (req, res) => {
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
            data: project
        });
    } catch (error) {
        logger.error('프로젝트 조회 실패', buildErrorLog(error, req));
        res.status(500).json({
            success: false,
            message: '프로젝트 정보를 가져오는데 실패했습니다.'
        });
    }
});

router.put('/projects/slug/:slug',
    authenticateToken,
    requirePermission('projects.update'),
    logActivity('update_project'),
    async (req, res) => {
        try {
            const parsed = parseProjectUpdateRequest(req);
            if (parsed.error) {
                return res.status(parsed.error.statusCode).json({
                    success: false,
                    message: parsed.error.message
                });
            }

            const updateResult = await updateProjectBySlug(parsed.projectSlug, parsed.sanitizedData, req);
            if (updateResult.notFound) {
                return res.status(404).json({
                    success: false,
                    message: '프로젝트를 찾을 수 없습니다.'
                });
            }

            res.json({
                success: true,
                message: '프로젝트가 수정되었습니다.',
                data: updateResult.project
            });
        } catch (error) {
            logger.error('프로젝트 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '프로젝트 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/projects/slug/:slug',
    authenticateToken,
    requirePermission('projects.delete'),
    logActivity('delete_project'),
    async (req, res) => {
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

            await Projects.delete(project.id);
            CacheUtils.invalidateResources('projects', 'tags');

            res.json({
                success: true,
                message: '프로젝트가 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('프로젝트 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '프로젝트 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
