const express = require('express');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const {
    CacheUtils,
    Skills,
    buildErrorLog,
    hasOwn,
    logger,
    normalizeSkillPayload
} = require('./common');

const router = express.Router();

/**
 * @swagger
 * /api/admin/skills:
 *   get:
 *     summary: 기술 스택 목록 조회 (관리자)
 *     tags: ['Admin - Skills']
 *   post:
 *     summary: 기술 스택 생성
 *     tags: ['Admin - Skills']
 * /api/admin/skills/{id}:
 *   put:
 *     summary: 기술 스택 수정
 *     tags: ['Admin - Skills']
 *   delete:
 *     summary: 기술 스택 삭제
 *     tags: ['Admin - Skills']
 */
router.get('/skills',
    authenticateToken,
    requirePermission('skills.read'),
    async (req, res) => {
        try {
            const skills = await Skills.getAll();

            res.json({
                success: true,
                data: skills
            });
        } catch (error) {
            logger.error('기술 스택 목록 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 목록을 가져오는데 실패했습니다.'
            });
        }
    }
);

router.post('/skills',
    authenticateToken,
    requirePermission('skills.create'),
    logActivity('create_skill'),
    async (req, res) => {
        try {
            const { data: cleanData, error } = normalizeSkillPayload(req.body, {
                requireRequired: true
            });
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error
                });
            }

            if (cleanData.is_featured && cleanData.display_order) {
                const existingSkill = await Skills.getByDisplayOrder(cleanData.display_order);
                if (existingSkill) {
                    return res.status(400).json({
                        success: false,
                        message: `표시 순서 ${cleanData.display_order}은(는) 이미 사용 중입니다. 다른 순서를 선택해주세요.`
                    });
                }
            }

            const skillId = await Skills.createSkill(cleanData);

            const newSkill = await Skills.getSkillById(skillId);
            CacheUtils.invalidateResources('skills');

            res.status(201).json({
                success: true,
                message: '기술 스택이 성공적으로 추가되었습니다.',
                data: newSkill
            });
        } catch (error) {
            logger.error('기술 스택 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 생성에 실패했습니다.'
            });
        }
    }
);

router.put('/skills/:id',
    authenticateToken,
    requirePermission('skills.update'),
    logActivity('update_skill'),
    async (req, res) => {
        try {
            const skillId = parsePositiveIntegerParam(req.params.id);
            if (!skillId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 기술 스택 ID가 필요합니다.'
                });
            }

            const existingSkill = await Skills.getSkillById(skillId);
            if (!existingSkill) {
                return res.status(404).json({
                    success: false,
                    message: '기술 스택을 찾을 수 없습니다.'
                });
            }

            const { data: cleanData, error } = normalizeSkillPayload(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error
                });
            }

            if (Object.keys(cleanData).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '수정할 기술 스택 필드가 필요합니다.'
                });
            }

            const nextIsFeatured = hasOwn(cleanData, 'is_featured')
                ? cleanData.is_featured
                : Boolean(existingSkill.is_featured);
            const nextDisplayOrder = hasOwn(cleanData, 'display_order')
                ? cleanData.display_order
                : existingSkill.display_order;
            if (nextIsFeatured && nextDisplayOrder) {
                const conflictingSkill = await Skills.getByDisplayOrder(nextDisplayOrder, skillId);
                if (conflictingSkill) {
                    return res.status(400).json({
                        success: false,
                        message: `표시 순서 ${nextDisplayOrder}은(는) 이미 사용 중입니다. 다른 순서를 선택해주세요.`
                    });
                }
            }

            await Skills.updateSkill(skillId, cleanData);

            const updatedSkill = await Skills.getSkillById(skillId);
            CacheUtils.invalidateResources('skills');

            res.json({
                success: true,
                message: '기술 스택이 성공적으로 수정되었습니다.',
                data: updatedSkill
            });
        } catch (error) {
            logger.error('기술 스택 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/skills/:id',
    authenticateToken,
    requirePermission('skills.delete'),
    logActivity('delete_skill'),
    async (req, res) => {
        try {
            const skillId = parsePositiveIntegerParam(req.params.id);

            if (!skillId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 기술 스택 ID가 필요합니다.'
                });
            }

            const existingSkill = await Skills.getSkillById(skillId);
            if (!existingSkill) {
                return res.status(404).json({
                    success: false,
                    message: '기술 스택을 찾을 수 없습니다.'
                });
            }
            await Skills.deleteSkill(skillId);
            CacheUtils.invalidateResources('skills');

            res.json({
                success: true,
                message: '기술 스택이 성공적으로 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('기술 스택 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
