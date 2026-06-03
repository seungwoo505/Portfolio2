const express = require('express');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const {
    CacheUtils,
    Skills,
    buildErrorLog,
    logger,
    normalizeSkillPayload
} = require('./common');
const {
    buildDisplayOrderConflictMessage,
    findFeaturedDisplayOrderConflict,
    getNextDisplayOrder
} = require('./display-order');

const router = express.Router();

/**
 * @swagger
 * /api/admin/skills/{id}:
 *   put:
 *     summary: 기술 스택 수정
 *     tags: ['Admin - Skills']
 *   delete:
 *     summary: 기술 스택 삭제
 *     tags: ['Admin - Skills']
 */
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

            const conflictingSkill = await findFeaturedDisplayOrderConflict(Skills, cleanData, {
                existingSkill,
                excludeSkillId: skillId
            });
            if (conflictingSkill) {
                return res.status(400).json({
                    success: false,
                    message: buildDisplayOrderConflictMessage(getNextDisplayOrder(cleanData, existingSkill))
                });
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
