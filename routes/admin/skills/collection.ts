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
    findFeaturedDisplayOrderConflict,
    respondToDisplayOrderConflict
} = require('./display-order');

const router = express.Router();

/**
 * @swagger
 * /admin/skills:
 *   get:
 *     summary: 기술 스택 목록 조회 (관리자)
 *     tags:
 *       - Admin - Skills
 *     security:
 *       - bearerAuth: []
 *     description: skills.read 권한이 필요합니다. 카테고리 순서, 스킬 표시 순서, 이름 순으로 정렬합니다.
 *     responses:
 *       '200':
 *         description: 카테고리 이름을 포함한 전체 스킬 목록
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: 스킬 ID
 *                           category_id:
 *                             type: integer
 *                             nullable: true
 *                             description: 카테고리 ID
 *                           category_name:
 *                             type: string
 *                             description: 카테고리 이름
 *                             nullable: true
 *                           name:
 *                             type: string
 *                             description: 기술명
 *                           proficiency_level:
 *                             type: integer
 *                             description: 숙련도
 *                             nullable: true
 *                           years_of_experience:
 *                             type: string
 *                             description: 경력 연수. MySQL DECIMAL 값은 문자열로 반환됩니다.
 *                             nullable: true
 *                             example: '3.5'
 *                           icon:
 *                             type: string
 *                             description: 아이콘
 *                             nullable: true
 *                           color:
 *                             type: string
 *                             description: 색상
 *                             nullable: true
 *                           display_order:
 *                             type: integer
 *                             description: 표시 순서
 *                             nullable: true
 *                           is_featured:
 *                             description: DB에서 반환한 0/1 상태값
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                           created_at:
 *                             type: string
 *                             description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                             nullable: true
 *                           updated_at:
 *                             type: string
 *                             description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                             nullable: true
 *                   required:
 *                     - success
 *                     - data
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
 *       '500':
 *         description: 서버 또는 권한 확인 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: 기술 스택 생성
 *     tags:
 *       - Admin - Skills
 *     security:
 *       - bearerAuth: []
 *     description: skills.create 권한이 필요합니다. name과 category_id가 필수이며 추천 스킬의 1 이상 표시 순서는 중복될 수 없습니다. 0은 여러 스킬에서 사용할 수 있습니다.
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
 *                 default: 50
 *               years_of_experience:
 *                 type: number
 *                 minimum: 0
 *                 nullable: true
 *                 description: 경력 연수. 소수 및 숫자 문자열을 허용합니다. null 또는 빈 문자열은 값을 지웁니다.
 *                 default: null
 *               icon:
 *                 type: string
 *                 description: 아이콘. null 또는 빈 문자열은 값을 지웁니다.
 *                 nullable: true
 *                 maxLength: 255
 *                 default: null
 *               color:
 *                 type: string
 *                 description: 색상. null 또는 빈 문자열은 값을 지웁니다.
 *                 nullable: true
 *                 maxLength: 20
 *                 default: null
 *               display_order:
 *                 type: integer
 *                 description: 표시 순서. 정수 문자열도 허용하며 추천 스킬끼리 1 이상 순서는 중복할 수 없습니다. 0은 중복 가능합니다.
 *                 minimum: 0
 *                 default: 0
 *               is_featured:
 *                 type: boolean
 *                 description: 추천 여부. true/false를 사용합니다. 문자열 true/false, 1/0, yes/no, on/off 및 숫자 1/0도 정규화합니다.
 *                 default: false
 *             required:
 *               - name
 *               - category_id
 *     responses:
 *       '201':
 *         description: 생성된 기술 스택
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
 *         description: 필수값 누락, 잘못된 입력값 또는 추천 스킬 표시 순서 중복
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
 *       '500':
 *         description: 서버 또는 권한 확인 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
            CacheUtils.invalidateResources('skills', 'projects');

            res.status(201).json({
                success: true,
                message: '기술 스택이 성공적으로 추가되었습니다.',
                data: newSkill
            });
        } catch (error) {
            if (respondToDisplayOrderConflict(error, res)) return;
            if (error?.code === 'SKILL_CATEGORY_NOT_FOUND') {
                return res.status(400).json({ success: false, message: '유효한 카테고리를 선택해주세요.' });
            }
            logger.error('기술 스택 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 생성에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
