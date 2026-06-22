import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    CacheUtils,
    Projects,
    authenticateToken,
    buildErrorLog,
    getPlainBody,
    hasRequiredStringFields,
    logActivity,
    logger,
    normalizeProjectContentFields,
    parsePagination,
    requirePermission,
    toOptionalBoolean,
    trimStringFields,
    verboseDebug
} = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /admin/projects:
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
 *       400:
 *         description: 잘못된 query 값
 *       500:
 *         description: 서버 오류
 *   post:
 *     summary: 프로젝트 생성
 *     tags: ['Admin - Projects']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: 프로젝트 생성 성공
 *       400:
 *         description: 잘못된 요청
 */
router.get('/projects', authenticateToken, requirePermission('projects.read'), async (req: Request, res: Response) => {
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
    async (req: Request, res: Response) => {
        try {
            const body = trimStringFields(getPlainBody(req), ['title', 'description']);

            const hasProjectDescription = [
                body.description,
                body.excerpt,
                body.meta_description,
                body.content_text,
                body.content
            ].some((value) => typeof value === 'string' && value.trim());

            if (!hasRequiredStringFields(body, ['title']) || !hasProjectDescription) {
                return res.status(400).json({
                    success: false,
                    message: '제목과 설명은 필수입니다.'
                });
            }

            const sanitizedData = normalizeProjectContentFields(body);

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

module.exports = router;
