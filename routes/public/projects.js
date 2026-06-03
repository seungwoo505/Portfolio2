const express = require('express');
const Projects = require('../../models/projects');
const { isValidSlug } = require('../../utils/slug');
const {
    CacheUtils,
    badRequest,
    buildPaginationMeta,
    buildProjectFilters,
    cacheKey,
    fail,
    incrementViewOnce,
    loadCachedPaginatedResource,
    loadCachedSlugResource,
    notFound,
    ok
} = require('./common');

const router = express.Router();

/**
 * @swagger
 * /api/public/projects:
 *   get:
 *     summary: 공개 프로젝트 목록 조회
 *     tags: ['Public']
 * /api/public/projects/{slug}:
 *   get:
 *     summary: 공개 프로젝트 상세 조회
 *     tags: ['Public']
 * /api/public/projects/{slug}/view:
 *   post:
 *     summary: 프로젝트 조회수 증가
 *     tags: ['Public']
 */
router.get('/projects', async (req, res) => {
    try {
        const filters = buildProjectFilters(req.query);
        if (filters.error) {
            return badRequest(res, filters.error);
        }
        const data = await loadCachedPaginatedResource({
            cachePrefix: 'projects',
            filters,
            loadItems: () => Projects.getWithFilters(filters),
            loadTotal: () => Projects.getCountWithFilters(filters)
        });

        return ok(res, data.items, {
            pagination: buildPaginationMeta(filters, data.total)
        });
    } catch (error) {
        return fail(res, error, req, '프로젝트 목록을 가져오는데 실패했습니다.');
    }
});

router.post('/projects/:slug/view', async (req, res) => {
    try {
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const project = await Projects.getBySlug(slug);
        if (!project || !project.is_published) {
            return notFound(res, '프로젝트를 찾을 수 없습니다.');
        }

        await incrementViewOnce({
            resourceType: 'project',
            slug,
            req,
            increment: () => Projects.incrementView(project.id),
            invalidate: () => {
                CacheUtils.del(cacheKey('project', 'slug', slug));
                CacheUtils.delPattern('projects:public:');
            }
        });

        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            success: true,
            message: '조회수가 증가되었습니다.'
        });
    } catch (error) {
        return fail(res, error, req, '프로젝트 조회수 증가에 실패했습니다.');
    }
});

router.get('/projects/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const data = await loadCachedSlugResource({
            cachePrefix: 'project',
            slug,
            loadResource: () => Projects.getBySlug(slug)
        });

        if (!data || !data.is_published) {
            return notFound(res, '프로젝트를 찾을 수 없습니다.');
        }

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '프로젝트 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
