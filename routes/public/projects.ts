import type { Request, Response, Router } from 'express';

const express = require('express');
const Projects = require('../../models/projects');
const { isValidSlug } = require('../../utils/slug');
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

type CatalogSectionConfig = {
    id: string;
    title: string;
    slug: string;
    description: string;
    type: string;
    filters: Record<string, unknown>;
};

const DEFAULT_CATALOG_SECTION_LIMIT = 4;
const MAX_CATALOG_SECTION_LIMIT = 12;

const CATALOG_SECTIONS: CatalogSectionConfig[] = [
    {
        id: 'featured',
        title: '추천 프로젝트',
        slug: 'featured-projects',
        description: '가장 먼저 보여줄 대표 프로젝트입니다.',
        type: 'featured',
        filters: {
            featured: true,
            sort: 'display_order',
            order: 'asc'
        }
    },
    {
        id: 'new_arrivals',
        title: '신규 입고',
        slug: 'new-arrivals',
        description: '최근 업데이트된 프로젝트입니다.',
        type: 'new_arrivals',
        filters: {
            sort: 'created_at',
            order: 'desc'
        }
    },
    {
        id: 'popular',
        title: '인기 프로젝트',
        slug: 'popular-projects',
        description: '조회수와 반응이 높은 프로젝트입니다.',
        type: 'popular',
        filters: {
            sort: 'view_count',
            order: 'desc'
        }
    },
    {
        id: 'case_studies',
        title: '케이스 스터디',
        slug: 'case-studies',
        description: '문제 해결 과정과 성과를 함께 보여주는 프로젝트입니다.',
        type: 'case_study',
        filters: {
            tags: ['case-study', 'case-studies'],
            sort: 'display_order',
            order: 'asc'
        }
    }
];

const normalizeCatalogLimit = (value: unknown) => {
    const rawValue = Array.isArray(value) ? value[0] : value;
    const parsed = Number.parseInt(String(rawValue ?? ''), 10);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_CATALOG_SECTION_LIMIT;
    }

    return Math.min(Math.max(parsed, 1), MAX_CATALOG_SECTION_LIMIT);
};

const buildSectionFilters = (section: CatalogSectionConfig, limit: number) => ({
    limit,
    offset: 0,
    status: 'published',
    published_only: true,
    ...section.filters
});

const loadCatalogSection = async (section: CatalogSectionConfig, limit: number) => {
    const filters = buildSectionFilters(section, limit);
    const [items, total] = await Promise.all([
        Projects.getWithFilters(filters),
        Projects.getCountWithFilters(filters)
    ]);

    return {
        id: section.id,
        title: section.title,
        slug: section.slug,
        description: section.description,
        type: section.type,
        items,
        total
    };
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

router.get('/projects/catalog', async (req: Request, res: Response) => {
    try {
        const sectionLimit = normalizeCatalogLimit(req.query.limit);
        const sections = await cached(
            cacheKey('projects', 'catalog', sectionLimit),
            () => Promise.all(
                CATALOG_SECTIONS.map(section => loadCatalogSection(section, sectionLimit))
            )
        );

        return ok(res, {
            sections,
            sectionLimit
        });
    } catch (error) {
        return fail(res, error, req, '프로젝트 카탈로그를 가져오는데 실패했습니다.');
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
