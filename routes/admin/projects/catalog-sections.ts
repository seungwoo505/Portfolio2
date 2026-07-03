import type { Request, Response, Router } from 'express';

const express = require('express');
const { isValidSlug } = require('../../../utils/slug');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const {
    CacheUtils,
    Projects,
    authenticateToken,
    buildErrorLog,
    getPlainBody,
    logActivity,
    logger,
    requirePermission,
    toOptionalBoolean
} = require('./common');

const router: Router = express.Router();

const VALID_SECTION_TYPES = ['featured', 'new_arrivals', 'popular', 'case_study', 'stack', 'custom'];

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const trimString = (value) => (typeof value === 'string' ? value.trim() : value);

const parseIntegerField = (value, fieldName) => {
    if (value === undefined || value === null || value === '') {
        return {
            value: 0
        };
    }

    const stringValue = String(value).trim();
    if (!/^-?\d+$/.test(stringValue)) {
        return {
            error: `${fieldName} 값은 정수여야 합니다.`
        };
    }

    return {
        value: Number(stringValue)
    };
};

const parseSectionPayload = (body, { partial = false } = {}) => {
    const payload: Record<string, any> = {};

    if (!partial || hasOwn(body, 'name')) {
        const name = trimString(body.name);
        if (!name) {
            return {
                error: '섹션 이름은 필수입니다.'
            };
        }
        payload.name = name;
    }

    if (!partial || hasOwn(body, 'slug')) {
        const slug = trimString(body.slug);
        if (!slug || !isValidSlug(slug)) {
            return {
                error: '유효한 섹션 slug가 필요합니다.'
            };
        }
        payload.slug = slug;
    }

    if (hasOwn(body, 'description')) {
        payload.description = trimString(body.description) || null;
    }

    if (hasOwn(body, 'section_type')) {
        const sectionType = trimString(body.section_type);
        if (!VALID_SECTION_TYPES.includes(sectionType)) {
            return {
                error: '유효한 section_type이 필요합니다.'
            };
        }
        payload.section_type = sectionType;
    } else if (!partial) {
        payload.section_type = 'custom';
    }

    if (hasOwn(body, 'display_order')) {
        const parsed = parseIntegerField(body.display_order, 'display_order');
        if (parsed.error) {
            return {
                error: parsed.error
            };
        }
        payload.display_order = parsed.value;
    } else if (!partial) {
        payload.display_order = 0;
    }

    if (hasOwn(body, 'is_active')) {
        const active = toOptionalBoolean(body.is_active);
        if (!active.isValid || active.value === null) {
            return {
                error: 'is_active 값은 boolean이어야 합니다.'
            };
        }
        payload.is_active = active.value ? 1 : 0;
    } else if (!partial) {
        payload.is_active = 1;
    }

    if (partial && Object.keys(payload).length === 0) {
        return {
            error: '수정할 섹션 정보가 필요합니다.'
        };
    }

    return {
        payload
    };
};

const parseSectionItems = (body) => {
    if (!Array.isArray(body.items)) {
        return {
            error: 'items 배열이 필요합니다.'
        };
    }

    const seenProjectIds = new Set();
    const items = [];

    for (let index = 0; index < body.items.length; index += 1) {
        const item = body.items[index];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return {
                error: 'items 항목은 객체여야 합니다.'
            };
        }

        const projectId = parsePositiveIntegerParam(item.project_id);
        if (!projectId) {
            return {
                error: '유효한 project_id가 필요합니다.'
            };
        }

        if (seenProjectIds.has(projectId)) {
            return {
                error: '같은 섹션에 동일한 프로젝트를 중복 배치할 수 없습니다.'
            };
        }
        seenProjectIds.add(projectId);

        const displayOrder = hasOwn(item, 'display_order')
            ? parseIntegerField(item.display_order, 'display_order')
            : { value: index };
        if (displayOrder.error) {
            return {
                error: displayOrder.error
            };
        }

        items.push({
            project_id: projectId,
            display_order: displayOrder.value,
            custom_label: trimString(item.custom_label) || null,
            custom_summary: trimString(item.custom_summary) || null
        });
    }

    return {
        items
    };
};

const getSectionWithItems = async (sectionId) => {
    const [section, items] = await Promise.all([
        Projects.getCatalogSectionById(sectionId),
        Projects.getCatalogSectionItems(sectionId)
    ]);

    return section ? {
        ...section,
        items
    } : null;
};

/**
 * @swagger
 * /admin/projects/catalog-sections:
 *   get:
 *     summary: 프로젝트 카탈로그 섹션 목록 조회
 *     tags: ['Admin - Projects']
 *   post:
 *     summary: 프로젝트 카탈로그 섹션 생성
 *     tags: ['Admin - Projects']
 * /admin/projects/catalog-sections/{id}:
 *   put:
 *     summary: 프로젝트 카탈로그 섹션 수정
 *     tags: ['Admin - Projects']
 *   delete:
 *     summary: 프로젝트 카탈로그 섹션 삭제
 *     tags: ['Admin - Projects']
 * /admin/projects/catalog-sections/{id}/items:
 *   put:
 *     summary: 프로젝트 카탈로그 섹션 아이템 전체 교체
 *     tags: ['Admin - Projects']
 */
router.get('/projects/catalog-sections',
    authenticateToken,
    requirePermission('projects.read'),
    async (_req: Request, res: Response) => {
        try {
            const sections = await Projects.getCatalogSectionsForAdmin();
            const sectionsWithItems = await Promise.all(
                sections.map(async (section) => ({
                    ...section,
                    items: await Projects.getCatalogSectionItems(section.id)
                }))
            );

            res.json({
                success: true,
                data: sectionsWithItems
            });
        } catch (error) {
            logger.error('프로젝트 카탈로그 섹션 목록 조회 실패', buildErrorLog(error, _req));
            res.status(500).json({
                success: false,
                message: '프로젝트 카탈로그 섹션을 가져오는데 실패했습니다.'
            });
        }
    }
);

router.post('/projects/catalog-sections',
    authenticateToken,
    requirePermission('projects.update'),
    logActivity('create_project_catalog_section'),
    async (req: Request, res: Response) => {
        try {
            const parsed = parseSectionPayload(getPlainBody(req));
            if (parsed.error) {
                return res.status(400).json({
                    success: false,
                    message: parsed.error
                });
            }

            const id = await Projects.createCatalogSection(parsed.payload);
            const section = await getSectionWithItems(id);
            CacheUtils.invalidateResources('projects');

            res.status(201).json({
                success: true,
                message: '프로젝트 카탈로그 섹션이 생성되었습니다.',
                data: section
            });
        } catch (error) {
            logger.error('프로젝트 카탈로그 섹션 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '프로젝트 카탈로그 섹션 생성에 실패했습니다.'
            });
        }
    }
);

router.put('/projects/catalog-sections/:id',
    authenticateToken,
    requirePermission('projects.update'),
    logActivity('update_project_catalog_section'),
    async (req: Request, res: Response) => {
        try {
            const sectionId = parsePositiveIntegerParam(req.params.id);
            if (!sectionId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 섹션 id가 필요합니다.'
                });
            }

            const existingSection = await Projects.getCatalogSectionById(sectionId);
            if (!existingSection) {
                return res.status(404).json({
                    success: false,
                    message: '프로젝트 카탈로그 섹션을 찾을 수 없습니다.'
                });
            }

            const parsed = parseSectionPayload(getPlainBody(req), { partial: true });
            if (parsed.error) {
                return res.status(400).json({
                    success: false,
                    message: parsed.error
                });
            }

            await Projects.updateCatalogSection(sectionId, parsed.payload);
            const section = await getSectionWithItems(sectionId);
            CacheUtils.invalidateResources('projects');

            res.json({
                success: true,
                message: '프로젝트 카탈로그 섹션이 수정되었습니다.',
                data: section
            });
        } catch (error) {
            logger.error('프로젝트 카탈로그 섹션 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '프로젝트 카탈로그 섹션 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/projects/catalog-sections/:id',
    authenticateToken,
    requirePermission('projects.delete'),
    logActivity('delete_project_catalog_section'),
    async (req: Request, res: Response) => {
        try {
            const sectionId = parsePositiveIntegerParam(req.params.id);
            if (!sectionId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 섹션 id가 필요합니다.'
                });
            }

            const deletedCount = await Projects.deleteCatalogSection(sectionId);
            if (deletedCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: '프로젝트 카탈로그 섹션을 찾을 수 없습니다.'
                });
            }

            CacheUtils.invalidateResources('projects');

            res.json({
                success: true,
                message: '프로젝트 카탈로그 섹션이 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('프로젝트 카탈로그 섹션 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '프로젝트 카탈로그 섹션 삭제에 실패했습니다.'
            });
        }
    }
);

router.put('/projects/catalog-sections/:id/items',
    authenticateToken,
    requirePermission('projects.update'),
    logActivity('update_project_catalog_section_items'),
    async (req: Request, res: Response) => {
        try {
            const sectionId = parsePositiveIntegerParam(req.params.id);
            if (!sectionId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 섹션 id가 필요합니다.'
                });
            }

            const section = await Projects.getCatalogSectionById(sectionId);
            if (!section) {
                return res.status(404).json({
                    success: false,
                    message: '프로젝트 카탈로그 섹션을 찾을 수 없습니다.'
                });
            }

            const parsed = parseSectionItems(getPlainBody(req));
            if (parsed.error) {
                return res.status(400).json({
                    success: false,
                    message: parsed.error
                });
            }

            const expectedIds = parsed.items.map((item) => item.project_id);
            const existingProjectIds = await Projects.getExistingProjectIds(expectedIds);
            const missingProjectIds = expectedIds.filter((id) => !existingProjectIds.includes(id));
            if (missingProjectIds.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: '존재하지 않는 프로젝트가 포함되어 있습니다.'
                });
            }

            await Projects.replaceCatalogSectionItems(sectionId, parsed.items);
            const updatedSection = await getSectionWithItems(sectionId);
            CacheUtils.invalidateResources('projects');

            res.json({
                success: true,
                message: '프로젝트 카탈로그 섹션 아이템이 수정되었습니다.',
                data: updatedSection
            });
        } catch (error) {
            logger.error('프로젝트 카탈로그 섹션 아이템 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '프로젝트 카탈로그 섹션 아이템 수정에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
