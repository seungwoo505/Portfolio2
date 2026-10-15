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
const {
    buildDisplayOrderConflictMessage,
    findFeaturedDisplayOrderConflict,
    getNextDisplayOrder,
    respondToDisplayOrderConflict
} = require('./display-order');

const router = express.Router();

/**
 * @swagger
 * /admin/skills/{id}/featured:
 *   patch:
 *     summary: 기술 추천 상태 변경
 *     tags:
 *       - Admin - Skills
 *     security:
 *       - bearerAuth: []
 *     description: skills.update 권한이 필요합니다. 추천으로 바꿀 때 현재 표시 순서가 1 이상이면 다른 추천 스킬과 중복 여부를 검사합니다.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: 기술 스택 ID
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_featured:
 *                 type: boolean
 *                 description: 추천 여부. true/false를 사용합니다. 문자열 true/false, 1/0, yes/no, on/off 및 숫자 1/0도 정규화합니다.
 *                 example: true
 *             required:
 *               - is_featured
 *     responses:
 *       '200':
 *         description: 기술 추천 상태 변경 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: 처리 성공 여부
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: 처리 결과 메시지
 *               required:
 *                 - success
 *                 - message
 *       '400':
 *         description: 유효하지 않은 ID·추천 상태 또는 추천 스킬 표시 순서 중복
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 해당 작업 권한이 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 기술 스택 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 또는 권한 확인 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /admin/skills/{id}/order:
 *   patch:
 *     summary: 기술 표시 순서 변경
 *     tags:
 *       - Admin - Skills
 *     security:
 *       - bearerAuth: []
 *     description: skills.update 권한이 필요합니다. 추천 스킬끼리 1 이상 순서는 중복할 수 없으며 0은 중복 가능합니다.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: 기술 스택 ID
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_order:
 *                 type: integer
 *                 description: 0 이상의 정수입니다. 정수 문자열도 허용하며 null·빈 문자열·소수는 허용하지 않습니다.
 *                 minimum: 0
 *                 example: 1
 *             required:
 *               - display_order
 *     responses:
 *       '200':
 *         description: 기술 표시 순서 변경 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: 처리 성공 여부
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: 처리 결과 메시지
 *               required:
 *                 - success
 *                 - message
 *       '400':
 *         description: 유효하지 않은 ID·순서 또는 추천 스킬 표시 순서 중복
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 해당 작업 권한이 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 기술 스택 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 또는 권한 확인 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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

            const payload = { is_featured: isFeatured };
            const conflict = await findFeaturedDisplayOrderConflict(Skills, payload, {
                existingSkill, excludeSkillId: skillId
            });
            if (conflict) {
                return res.status(400).json({
                    success: false,
                    message: buildDisplayOrderConflictMessage(getNextDisplayOrder(payload, existingSkill))
                });
            }
            await Skills.updateSkill(skillId, payload);
            CacheUtils.invalidateResources('skills', 'projects');

            res.json({
                success: true,
                message: `기술 스택이 ${isFeatured ? '추천' : '일반'} 상태로 변경되었습니다.`
            });
        } catch (error) {
            if (respondToDisplayOrderConflict(error, res)) return;
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

            const payload = { display_order: displayOrder };
            const conflict = await findFeaturedDisplayOrderConflict(Skills, payload, {
                existingSkill, excludeSkillId: skillId
            });
            if (conflict) {
                return res.status(400).json({
                    success: false,
                    message: buildDisplayOrderConflictMessage(displayOrder)
                });
            }
            await Skills.updateSkill(skillId, payload);
            CacheUtils.invalidateResources('skills', 'projects');

            res.json({
                success: true,
                message: '기술 스택 순서가 성공적으로 변경되었습니다.'
            });
        } catch (error) {
            if (respondToDisplayOrderConflict(error, res)) return;
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
