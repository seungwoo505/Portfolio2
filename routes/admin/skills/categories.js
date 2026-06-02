const express = require('express');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const { getPlainBody } = require('../../../utils/request-body');
const {
    CacheUtils,
    Skills,
    buildErrorLog,
    logger,
    toStringValue
} = require('./common');

const router = express.Router();

/**
 * @swagger
 * /api/admin/skills/categories:
 *   post:
 *     summary: 스킬 카테고리 생성
 *     tags: ['Admin - Skills']
 *   get:
 *     summary: 스킬 카테고리 목록 조회
 *     tags: ['Admin - Skills']
 * /api/admin/skills/categories/{id}:
 *   delete:
 *     summary: 스킬 카테고리 삭제
 *     tags: ['Admin - Skills']
 */
router.post('/skills/categories',
    authenticateToken,
    requirePermission('skills.create'),
    logActivity('create_skill_category'),
    async (req, res) => {
        try {
            const body = getPlainBody(req);
            const name = toStringValue(body.name).trim();

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: '카테고리명을 입력해주세요.'
                });
            }
            const existingCategory = await Skills.getCategoryByName(name);

            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: '이미 존재하는 카테고리명입니다.'
                });
            }

            const categoryId = await Skills.createCategory(name);
            CacheUtils.invalidateResources('skills');

            res.status(201).json({
                success: true,
                message: '카테고리가 성공적으로 추가되었습니다.',
                data: { id: categoryId, name }
            });
        } catch (error) {
            logger.error('카테고리 추가 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '카테고리 추가에 실패했습니다.'
            });
        }
    }
);

router.delete('/skills/categories/:id',
    authenticateToken,
    requirePermission('skills.delete'),
    logActivity('delete_skill_category'),
    async (req, res) => {
        try {
            const categoryId = parsePositiveIntegerParam(req.params.id);

            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 카테고리 ID가 필요합니다.'
                });
            }

            const existingCategory = await Skills.getCategoryById(categoryId);
            if (!existingCategory) {
                return res.status(404).json({
                    success: false,
                    message: '카테고리를 찾을 수 없습니다.'
                });
            }

            const skillsUsingCategory = await Skills.getSkillsByCategory(categoryId);

            if (skillsUsingCategory && skillsUsingCategory.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: '이 카테고리를 사용하는 기술 스택이 있어서 삭제할 수 없습니다.',
                    data: {
                        category_id: categoryId,
                        skills_count: skillsUsingCategory.length,
                        skills: skillsUsingCategory.map(skill => ({ id: skill.id, name: skill.name }))
                    }
                });
            }

            await Skills.deleteCategory(categoryId);
            CacheUtils.invalidateResources('skills');

            res.json({
                success: true,
                message: '카테고리가 성공적으로 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('카테고리 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '카테고리 삭제에 실패했습니다.'
            });
        }
    }
);

router.get('/skills/categories',
    authenticateToken,
    requirePermission('skills.read'),
    async (req, res) => {
        try {
            const categories = await Skills.getCategories();

            res.json({
                success: true,
                data: categories
            });
        } catch (error) {
            logger.error('카테고리 목록 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '카테고리 목록을 가져오는데 실패했습니다.'
            });
        }
    }
);

module.exports = router;
