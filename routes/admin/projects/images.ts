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
    parseSlugParam,
    requirePermission
} = require('./common');

const router: Router = express.Router();

const VALID_IMAGE_TYPES = ['catalog', 'cover', 'gallery', 'detail', 'og'];

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const trimString = (value) => (typeof value === 'string' ? value.trim() : value);

const parseOptionalInteger = (value, fieldName) => {
    if (value === undefined || value === null || value === '') {
        return {
            value: null
        };
    }

    const normalized = String(value).trim();
    if (!/^\d+$/.test(normalized)) {
        return {
            error: `${fieldName} 값은 0 이상의 정수여야 합니다.`
        };
    }

    return {
        value: Number(normalized)
    };
};

const defaultIntegerResult = (value: number): Record<string, any> => ({
    value
});

const parseOptionalBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') {
        return {
            value: fallback
        };
    }

    if (value === true || value === false) {
        return {
            value
        };
    }

    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return {
            value: true
        };
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
        return {
            value: false
        };
    }

    return {
        error: 'is_primary 값은 boolean이어야 합니다.'
    };
};

const parseImagesPayload = (body) => {
    if (!Array.isArray(body.images)) {
        return {
            error: 'images 배열이 필요합니다.'
        };
    }

    const images = [];

    for (const [index, image] of body.images.entries()) {
        if (!image || typeof image !== 'object' || Array.isArray(image)) {
            return {
                error: 'images 항목은 객체여야 합니다.'
            };
        }

        const imageUrl = trimString(image.image_url || image.url);
        if (!imageUrl) {
            return {
                error: 'image_url은 필수입니다.'
            };
        }

        const imageType = trimString(image.image_type || image.type || 'gallery');
        if (!VALID_IMAGE_TYPES.includes(imageType)) {
            return {
                error: '유효한 image_type이 필요합니다.'
            };
        }

        const width = parseOptionalInteger(image.width, 'width');
        if (width.error) {
            return {
                error: width.error
            };
        }

        const height = parseOptionalInteger(image.height, 'height');
        if (height.error) {
            return {
                error: height.error
            };
        }

        const displayOrder = hasOwn(image, 'display_order')
            ? parseOptionalInteger(image.display_order, 'display_order')
            : defaultIntegerResult(index);
        if (displayOrder.error) {
            return {
                error: displayOrder.error
            };
        }

        const isPrimary = parseOptionalBoolean(image.is_primary, index === 0);
        if (isPrimary.error) {
            return {
                error: isPrimary.error
            };
        }

        images.push({
            image_type: imageType,
            image_url: imageUrl,
            alt_text: trimString(image.alt_text || image.alt) || null,
            caption: trimString(image.caption) || null,
            width: width.value,
            height: height.value,
            display_order: displayOrder.value,
            is_primary: isPrimary.value
        });
    }

    return {
        images
    };
};

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
