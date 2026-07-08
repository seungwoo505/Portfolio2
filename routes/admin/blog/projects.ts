import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    BlogPosts,
    authenticateToken,
    buildErrorLog,
    logActivity,
    logger,
    parseSlugParam,
    requirePermission
} = require('./common');
const {
    findBlogPostBySlug,
    parseBlogPostSlugParam
} = require('./lookup');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');

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

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const trimString = (value) => (typeof value === 'string' ? value.trim() : value);

const parseOptionalInteger = (value, fieldName, fallback): Record<string, any> => {
    if (value === undefined || value === null || value === '') {
        return {
            value: fallback
        };
    }

    const normalized = String(value).trim();
    if (!/^\d+$/.test(normalized)) {
        return {
            error: `${fieldName} 값은 0 이상의 정수여야 합니다.`
        };
    }

    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed)) {
        return {
            error: `${fieldName} 값은 0 이상의 정수여야 합니다.`
        };
    }

    return {
        value: parsed
    };
};

const parseProjectLinkItem = (item, index): Record<string, any> => {
    if (typeof item === 'number' || typeof item === 'string') {
        const value = String(item).trim();
        if (!value) {
            return {
                error: '유효한 project slug 또는 project_id가 필요합니다.'
            };
        }

        if (/^\d+$/.test(value)) {
            const projectId = parsePositiveIntegerParam(value);
            return projectId
                ? {
                    project: {
                        project_id: projectId,
                        display_order: index,
                        relation_label: null
                    }
                }
                : {
                    error: '유효한 project slug 또는 project_id가 필요합니다.'
                };
        }

        const slug = parseSlugParam(value);
        return slug
            ? {
                project: {
                    slug,
                    display_order: index,
                    relation_label: null
                }
            }
            : {
                error: '유효한 project slug 또는 project_id가 필요합니다.'
            };
    }

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return {
            error: 'projects 항목은 객체, slug 문자열, project_id 숫자여야 합니다.'
        };
    }

    const rawId = item.project_id ?? item.id;
    const project: Record<string, any> = {};

    if (rawId !== undefined && rawId !== null && rawId !== '') {
        const projectId = parsePositiveIntegerParam(rawId);
        if (!projectId) {
            return {
                error: '유효한 project_id가 필요합니다.'
            };
        }
        project.project_id = projectId;
    } else {
        const slug = parseSlugParam(trimString(item.slug));
        if (!slug) {
            return {
                error: '유효한 project slug 또는 project_id가 필요합니다.'
            };
        }
        project.slug = slug;
    }

    const displayOrder = hasOwn(item, 'display_order')
        ? parseOptionalInteger(item.display_order, 'display_order', index)
        : { value: index };
    if (displayOrder.error) return displayOrder;

    project.display_order = displayOrder.value;
    project.relation_label = trimString(item.relation_label) || null;

    return {
        project
    };
};

const getProjectDuplicateKey = (project) => (
    project.project_id ? `id:${project.project_id}` : `slug:${project.slug}`
);

const parseProjectsPayload = (body): Record<string, any> => {
    const source = body.projects ?? body.related_projects;
    if (!Array.isArray(source)) {
        return {
            error: 'projects 배열이 필요합니다.'
        };
    }

    const seenProjects = new Set();
    const projects = [];

    for (const [index, item] of source.entries()) {
        const parsed = parseProjectLinkItem(item, index);
        if (parsed.error) return parsed;

        const duplicateKey = getProjectDuplicateKey(parsed.project);
        if (seenProjects.has(duplicateKey)) {
            return {
                error: 'projects에 동일한 프로젝트를 중복 입력할 수 없습니다.'
            };
        }
        seenProjects.add(duplicateKey);
        projects.push(parsed.project);
    }

    return {
        projects
    };
};

/**
 * @swagger
 * /admin/blog/posts/slug/{slug}/projects:
 *   get:
 *     summary: 블로그 포스트에 연결된 프로젝트 목록 조회
 *     tags: ['Admin - Blog']
 *   put:
 *     summary: 블로그 포스트 프로젝트 연결 전체 교체
 *     tags: ['Admin - Blog']
 */
router.get('/blog/posts/slug/:slug/projects',
    authenticateToken,
    requirePermission('blog.read'),
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

            const projects = await BlogPosts.getRelatedProjects(lookup.post.id);
            res.json({
                success: true,
                data: projects
            });
        } catch (error) {
            logger.error('블로그 프로젝트 연결 목록 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '블로그 프로젝트 연결 목록 조회에 실패했습니다.'
            });
        }
    }
);

router.put('/blog/posts/slug/:slug/projects',
    authenticateToken,
    requirePermission('blog.update'),
    logActivity('update_blog_project_links'),
    async (req: Request, res: Response) => {
        try {
            const parsed = parseBlogPostSlugParam(req.params.slug);
            if (parsed.error) {
                return sendRouteError(res, parsed.error);
            }

            const projectsPayload = parseProjectsPayload(req.body || {});
            if (projectsPayload.error) {
                return res.status(400).json({
                    success: false,
                    message: projectsPayload.error
                });
            }

            const lookup = await findBlogPostBySlug(parsed.postSlug);
            if (lookup.error) {
                return sendRouteError(res, lookup.error);
            }

            await BlogPosts.updateProjects(lookup.post.id, projectsPayload.projects);
            BlogPosts.invalidateCache();
            const projects = await BlogPosts.getRelatedProjects(lookup.post.id);

            res.json({
                success: true,
                message: '블로그 프로젝트 연결이 수정되었습니다.',
                data: projects
            });
        } catch (error) {
            logger.error('블로그 프로젝트 연결 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '블로그 프로젝트 연결 수정에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
