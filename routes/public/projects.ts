import type { Request, Response, Router } from 'express';

const express = require('express');
const Projects = require('../../models/projects');
const { isValidSlug } = require('../../utils/slug');
const { clampInteger } = require('../../utils/pagination');
const {
    CacheUtils,
    badRequest,
    buildPaginationMeta,
    buildProjectFilters,
    cacheKey,
    cached,
    fail,
    incrementViewOnce,
    loadCachedPaginatedResource,
    loadCachedSlugResource,
    notFound,
    ok
} = require('./common');

const router: Router = express.Router();

const DEFAULT_CATALOG_SECTION_LIMIT = 4;
const MAX_CATALOG_SECTION_LIMIT = 12;
const DEFAULT_RELATED_PROJECT_LIMIT = 4;
const MAX_RELATED_PROJECT_LIMIT = 12;
const DEFAULT_RECOMMENDED_PROJECT_LIMIT = 8;
const MAX_RECOMMENDED_PROJECT_LIMIT = 16;

const normalizeCatalogLimit = (value: unknown) => {
    return clampInteger(value, {
        min: 1,
        max: MAX_CATALOG_SECTION_LIMIT,
        fallback: DEFAULT_CATALOG_SECTION_LIMIT
    });
};

const normalizeRelatedProjectLimit = (value: unknown) => {
    return clampInteger(value, {
        min: 1,
        max: MAX_RELATED_PROJECT_LIMIT,
        fallback: DEFAULT_RELATED_PROJECT_LIMIT
    });
};

const normalizeRecommendedProjectLimit = (value: unknown) => {
    return clampInteger(value, {
        min: 1,
        max: MAX_RECOMMENDED_PROJECT_LIMIT,
        fallback: DEFAULT_RECOMMENDED_PROJECT_LIMIT
    });
};

/**
 * @swagger
 * /public/projects:
 *   get:
 *     summary: 공개 프로젝트 목록 조회
 *     tags: ['Public']
 * /public/projects/{slug}:
 *   get:
 *     summary: 공개 프로젝트 상세 조회
 *     tags: ['Public']
 * /public/projects/{slug}/view:
 *   post:
 *     summary: 프로젝트 조회수 증가
 *     tags: ['Public']
 * /public/projects/catalog:
 *   get:
 *     summary: 쇼핑몰형 프로젝트 카탈로그 섹션 조회
 *     tags: ['Public']
 * /public/projects/filter-options:
 *   get:
 *     summary: 프로젝트 필터 옵션 조회
 *     tags: ['Public']
 * /public/projects/recommendations:
 *   get:
 *     summary: 조회수와 카탈로그 우선순위 기반 추천 프로젝트 조회
 *     tags: ['Public']
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 8
 *           maximum: 16
 *         description: 반환할 추천 프로젝트 수
 *     responses:
 *       200:
 *         description: 추천 프로젝트 조회 성공
 * /public/projects/{slug}/related:
 *   get:
 *     summary: 관련 프로젝트 조회
 *     tags: ['Public']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4
 *           maximum: 12
 *         description: 반환할 관련 프로젝트 수
 *     responses:
 *       200:
 *         description: 관련 프로젝트 조회 성공
 *       404:
 *         description: 기준 프로젝트 없음
 */
router.get('/projects', async (req: Request, res: Response) => {
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

router.get('/projects/filter-options', async (req: Request, res: Response) => {
    try {
        const options = await cached(
            cacheKey('projects', 'filter-options'),
            () => Projects.getFilterOptions()
        );

        return ok(res, options);
    } catch (error) {
        return fail(res, error, req, '프로젝트 필터 옵션을 가져오는데 실패했습니다.');
    }
});

router.get('/projects/catalog', async (req: Request, res: Response) => {
    try {
        const sectionLimit = normalizeCatalogLimit(req.query.limit);
        const sections = await cached(
            cacheKey('projects', 'catalog', sectionLimit),
            () => Projects.getCatalogSections(sectionLimit)
        );

        return ok(res, {
            sections,
            sectionLimit
        });
    } catch (error) {
        return fail(res, error, req, '프로젝트 카탈로그를 가져오는데 실패했습니다.');
    }
});

router.get('/projects/recommendations', async (req: Request, res: Response) => {
    try {
        const limit = normalizeRecommendedProjectLimit(req.query.limit);
        const items = await cached(
            cacheKey('projects', 'recommendations', limit),
            () => Projects.getRecommendations(limit)
        );

        return ok(res, {
            items,
            limit
        });
    } catch (error) {
        return fail(res, error, req, '추천 프로젝트를 가져오는데 실패했습니다.');
    }
});

router.get('/projects/:slug/related', async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const limit = normalizeRelatedProjectLimit(req.query.limit);
        const items = await cached(
            cacheKey('projects', 'related', slug, limit),
            () => Projects.getRelatedProjects(slug, limit)
        );

        if (!items) {
            return notFound(res, '프로젝트를 찾을 수 없습니다.');
        }

        return ok(res, {
            items,
            limit
        });
    } catch (error) {
        return fail(res, error, req, '관련 프로젝트를 가져오는데 실패했습니다.');
    }
});

router.post('/projects/:slug/view', async (req: Request, res: Response) => {
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

router.get('/projects/:slug', async (req: Request, res: Response) => {
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
