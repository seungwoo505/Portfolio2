const express = require('express');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const {
    CacheUtils,
    Skills,
    buildErrorLog,
    logger,
    parseNumber,
    toBooleanOrNull
} = require('./common');

const router = express.Router();

/**
 * @swagger
 * /admin/skills/{id}/featured:
 *   patch:
 *     summary: 기술 추천 상태 변경
 *     tags: ['Admin - Skills']
 * /admin/skills/{id}/order:
 *   patch:
 *     summary: 기술 표시 순서 변경
 *     tags: ['Admin - Skills']
 */
router.patch('/skills/:id/featured',
    authenticateToken,
    requirePermission('skills.update'),
    logActivity('toggle_skill_featured'),
    async (req, res) => {
        try {
            const skillId = parsePositiveIntegerParam(req.params.id);
            if (!skillId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 기술 스택 ID가 필요합니다.'
                });
            }

            const isFeatured = toBooleanOrNull(req.body?.is_featured);

            if (isFeatured === null) {
                return res.status(400).json({
                    success: false,
                    message: '추천 상태는 boolean 값이어야 합니다.'
                });
            }

            const existingSkill = await Skills.getSkillById(skillId);
            if (!existingSkill) {
                return res.status(404).json({
                    success: false,
                    message: '기술 스택을 찾을 수 없습니다.'
                });
            }

            await Skills.updateSkill(skillId, { is_featured: isFeatured });
            CacheUtils.invalidateResources('skills');

            res.json({
                success: true,
                message: `기술 스택이 ${isFeatured ? '추천' : '일반'} 상태로 변경되었습니다.`
            });
        } catch (error) {
            logger.error('기술 스택 추천 상태 변경 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 추천 상태 변경에 실패했습니다.'
            });
        }
    }
);

router.patch('/skills/:id/order',
    authenticateToken,
    requirePermission('skills.update'),
    logActivity('update_skill_order'),
    async (req, res) => {
        try {
            const skillId = parsePositiveIntegerParam(req.params.id);
            if (!skillId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 기술 스택 ID가 필요합니다.'
                });
            }

            const displayOrder = parseNumber(req.body?.display_order, { integer: true, min: 0 });

            if (displayOrder === undefined || displayOrder === null) {
                return res.status(400).json({
                    success: false,
                    message: '표시 순서는 0 이상의 숫자여야 합니다.'
                });
            }

            const existingSkill = await Skills.getSkillById(skillId);
            if (!existingSkill) {
                return res.status(404).json({
                    success: false,
                    message: '기술 스택을 찾을 수 없습니다.'
                });
            }

            await Skills.updateSkill(skillId, { display_order: displayOrder });
            CacheUtils.invalidateResources('skills');

            res.json({
                success: true,
                message: '기술 스택 순서가 성공적으로 변경되었습니다.'
            });
        } catch (error) {
            logger.error('기술 스택 순서 변경 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 순서 변경에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
