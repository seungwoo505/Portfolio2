const express = require('express');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    CacheUtils,
    Skills,
    buildErrorLog,
    logger,
    normalizeSkillPayload
} = require('./common');
const {
    buildDisplayOrderConflictMessage,
    findFeaturedDisplayOrderConflict
} = require('./display-order');

const router = express.Router();

/**
 * @swagger
 * /admin/skills:
 *   get:
 *     summary: 기술 스택 목록 조회 (관리자)
 *     tags: ['Admin - Skills']
 *   post:
 *     summary: 기술 스택 생성
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

            const existingOrderSkill = await findFeaturedDisplayOrderConflict(Skills, cleanData);
            if (existingOrderSkill) {
                return res.status(400).json({
                    success: false,
                    message: buildDisplayOrderConflictMessage(cleanData.display_order)
                });
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

module.exports = router;
