const express = require('express');
const router = express.Router();
const { logger, verboseDebug, buildErrorLog } = require('./common');
const Projects = require('../../models/projects');
const CacheUtils = require('../../utils/cache');
const { parsePagination } = require('../../utils/pagination');
const { toOptionalBoolean } = require('../../utils/filter-values');
const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../utils/request-body');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');

const normalizeUndefinedFields = (body) => {
    const normalizedData = {};

    Object.keys(body).forEach((key) => {
        normalizedData[key] = body[key] === undefined ? null : body[key];
    });

    return normalizedData;
};

/**
 * @swagger
 * /api/admin/projects:
 *   get:
 *     summary: 관리자 프로젝트 목록 조회
 *     tags: ['Admin - Projects']
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
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *           description: 추천 프로젝트만 조회
 *     responses:
 *       200:
 *         description: 프로젝트 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     additionalProperties: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       500:
 *         description: 서버 오류
 *   post:
 *     summary: 프로젝트 생성
 *     tags: ['Admin - Projects']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       201:
 *         description: 프로젝트 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   additionalProperties: true
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/projects', authenticateToken, requirePermission('projects.read'), async (req, res) => {
    try {
        const pagination = parsePagination(req.query, {
            defaultLimit: 20,
            maxLimit: 100
        });
        const featured = toOptionalBoolean(req.query.featured);
        if (!featured.isValid) {
            return res.status(400).json({
                success: false,
                message: 'featured 값은 boolean이어야 합니다.'
            });
        }

        let projects;
        let total;
        if (featured.value === true) {
            [projects, total] = await Promise.all([
                Projects.getFeatured(pagination.limit, pagination.offset),
                Projects.getCountWithFilters({
                    featured: true,
                    status: 'published',
                    published_only: true
                })
            ]);
        } else {
            [projects, total] = await Promise.all([
                Projects.getAll(pagination.limit, pagination.offset),
                Projects.getCountWithFilters({
                    status: 'all',
                    published_only: false
                })
            ]);
        }

        res.json({
            success: true,
            data: projects,
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total,
                totalPages: Math.ceil(total / pagination.limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '프로젝트를 가져오는데 실패했습니다.'
        });
    }
});

router.post('/projects',
    authenticateToken,
    requirePermission('projects.create'),
    logActivity('create_project'),
    async (req, res) => {
        try {
            const body = trimStringFields(getPlainBody(req), ['title', 'description']);

            if (!hasRequiredStringFields(body, ['title', 'description'])) {
                return res.status(400).json({
                    success: false,
                    message: '제목과 설명은 필수입니다.'
                });
            }

            const sanitizedData = normalizeUndefinedFields(body);

            verboseDebug('원본 데이터:', body);
            verboseDebug('정규화된 데이터:', sanitizedData);
            verboseDebug('undefined 값이 있는지 확인:', Object.values(sanitizedData).some(v => v === undefined));

            const id = await Projects.create(sanitizedData);
            const newProject = await Projects.getById(id);
            CacheUtils.invalidateResources('projects', 'tags');

            res.status(201).json({
                success: true,
                message: '프로젝트가 생성되었습니다.',
                data: newProject
            });
        } catch (error) {
            logger.error('프로젝트 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '프로젝트 생성에 실패했습니다.'
            });
        }
    }
);

/**
 * @swagger
 * /api/admin/projects/slug/{slug}:
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   additionalProperties: true
 *       404:
 *         description: 프로젝트 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     summary: 프로젝트 수정
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
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: 프로젝트 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   additionalProperties: true
 *       404:
 *         description: 프로젝트 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: 프로젝트 삭제
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
 *         description: 프로젝트 삭제 성공
 *       404:
 *         description: 프로젝트 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/projects/slug/:slug', authenticateToken, requirePermission('projects.read'), async (req, res) => {
    try {
        const project = await Projects.getBySlug(req.params.slug);

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
            const projectSlug = req.params.slug;
            const body = trimStringFields(getPlainBody(req), ['title', 'description']);
            verboseDebug('projectSlug:', projectSlug);

            if (Object.keys(body).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '수정할 프로젝트 정보가 필요합니다.'
                });
            }

            if (hasInvalidProvidedStringFields(body, ['title', 'description'])) {
                return res.status(400).json({
                    success: false,
                    message: '제목과 설명은 비어 있을 수 없습니다.'
                });
            }

            verboseDebug('Projects.getBySlug 호출 시작');
            const existingProject = await Projects.getBySlug(projectSlug);
            verboseDebug('Projects.getById 결과:', existingProject);
            if (!existingProject) {
                verboseDebug('프로젝트를 찾을 수 없음');
                return res.status(404).json({
                    success: false,
                    message: '프로젝트를 찾을 수 없습니다.'
                });
            }
            verboseDebug('프로젝트 존재 확인 완료');

            const sanitizedData = normalizeUndefinedFields(body);

            verboseDebug('프로젝트 수정 - 원본 데이터:', body);
            verboseDebug('프로젝트 수정 - 정규화된 데이터:', sanitizedData);
            verboseDebug('프로젝트 수정 - undefined 값이 있는지 확인:', Object.values(sanitizedData).some(v => v === undefined));

            verboseDebug('Projects.update 호출 시작');
            verboseDebug('projectSlug:', projectSlug);
            verboseDebug('sanitizedData:', sanitizedData);

            try {
                const updatedProject = await Projects.update(existingProject.id, sanitizedData);
                verboseDebug('Projects.update 성공:', updatedProject);
                CacheUtils.invalidateResources('projects', 'tags');

                res.json({
                    success: true,
                    message: '프로젝트가 수정되었습니다.',
                    data: updatedProject
                });
            } catch (updateError) {
                logger.error('프로젝트 업데이트 실패', buildErrorLog(updateError, req));
                throw updateError;
            }
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
            const projectSlug = req.params.slug;

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
