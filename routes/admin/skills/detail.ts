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
    getNextDisplayOrder,
    respondToDisplayOrderConflict
} = require('./display-order');

const router = express.Router();

/**
 * @swagger
 * /admin/skills/{id}:
 *   put:
 *     summary: 기술 스택 수정
 *     tags:
 *       - Admin - Skills
 *     security:
 *       - bearerAuth: []
 *     description: skills.update 권한이 필요합니다. 제공한 필드만 수정합니다. 문서에 나열된 수정 가능 필드 중 하나 이상이 필요합니다.
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
 *               name:
 *                 type: string
 *                 description: 기술명
 *                 minLength: 1
 *                 pattern: \S
 *                 maxLength: 100
 *                 example: TypeScript
 *               category_id:
 *                 type: integer
 *                 description: 카테고리 ID. 정수 문자열도 허용합니다.
 *                 minimum: 1
 *                 example: 1
 *               proficiency_level:
 *                 type: integer
 *                 description: 숙련도. 정수 문자열도 허용합니다.
 *                 minimum: 0
 *                 maximum: 100
 *               years_of_experience:
 *                 type: number
 *                 minimum: 0
 *                 nullable: true
 *                 description: 경력 연수. 소수 및 숫자 문자열을 허용합니다. null 또는 빈 문자열은 값을 지웁니다.
 *               icon:
 *                 type: string
 *                 description: 아이콘. null 또는 빈 문자열은 값을 지웁니다.
 *                 nullable: true
 *                 maxLength: 255
 *               color:
 *                 type: string
 *                 description: 색상. null 또는 빈 문자열은 값을 지웁니다.
 *                 nullable: true
 *                 maxLength: 20
 *               display_order:
 *                 type: integer
 *                 description: 표시 순서. 정수 문자열도 허용하며 추천 스킬끼리 1 이상 순서는 중복할 수 없습니다. 0은 중복 가능합니다.
 *                 minimum: 0
 *               is_featured:
 *                 type: boolean
 *                 description: 추천 여부. true/false를 사용합니다. 문자열 true/false, 1/0, yes/no, on/off 및 숫자 1/0도 정규화합니다.
 *             minProperties: 1
 *             anyOf:
 *               - required:
 *                   - name
 *               - required:
 *                   - category_id
 *               - required:
 *                   - proficiency_level
 *               - required:
 *                   - years_of_experience
 *               - required:
 *                   - icon
 *               - required:
 *                   - color
 *               - required:
 *                   - display_order
 *               - required:
 *                   - is_featured
 *     responses:
 *       '200':
 *         description: 수정된 기술 스택
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           description: 스킬 ID
 *                         category_id:
 *                           type: integer
 *                           nullable: true
 *                           description: 카테고리 ID
 *                         category_name:
 *                           type: string
 *                           description: 카테고리 이름
 *                           nullable: true
 *                         name:
 *                           type: string
 *                           description: 기술명
 *                         proficiency_level:
 *                           type: integer
 *                           description: 숙련도
 *                           nullable: true
 *                         years_of_experience:
 *                           type: string
 *                           description: 경력 연수. MySQL DECIMAL 값은 문자열로 반환됩니다.
 *                           nullable: true
 *                           example: '3.5'
 *                         icon:
 *                           type: string
 *                           description: 아이콘
 *                           nullable: true
 *                         color:
 *                           type: string
 *                           description: 색상
 *                           nullable: true
 *                         display_order:
 *                           type: integer
 *                           description: 표시 순서
 *                           nullable: true
 *                         is_featured:
 *                           description: DB에서 반환한 0/1 상태값
 *                           type: integer
 *                           enum:
 *                             - 0
 *                             - 1
 *                             - null
 *                           nullable: true
 *                         created_at:
 *                           type: string
 *                           description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                           nullable: true
 *                         updated_at:
 *                           type: string
 *                           description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                           nullable: true
 *                     message:
 *                       type: string
 *                       description: 처리 결과 메시지
 *                   required:
 *                     - success
 *                     - data
 *                     - message
 *       '400':
 *         description: 유효하지 않은 ID, 수정 가능한 필드 누락, 잘못된 입력값 또는 추천 순서 중복
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
 *   delete:
 *     summary: 기술 스택 삭제
 *     tags:
 *       - Admin - Skills
 *     security:
 *       - bearerAuth: []
 *     description: skills.delete 권한이 필요합니다.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: 기술 스택 ID
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: 기술 스택 삭제 완료
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
 *         description: 유효하지 않은 기술 스택 ID
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
            CacheUtils.invalidateResources('skills', 'projects');

            res.json({
                success: true,
                message: '기술 스택이 성공적으로 수정되었습니다.',
                data: updatedSkill
            });
        } catch (error) {
            if (respondToDisplayOrderConflict(error, res)) return;
            if (error?.code === 'SKILL_CATEGORY_NOT_FOUND') {
                return res.status(400).json({ success: false, message: '유효한 카테고리를 선택해주세요.' });
            }
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
            CacheUtils.invalidateResources('skills', 'projects');

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
export {};
