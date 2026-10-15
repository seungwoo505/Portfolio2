const express = require('express');
const { logger, buildErrorLog } = require('../common');
const Experiences = require('../../../models/experiences');
const CacheUtils = require('../../../utils/cache');
const { toStringValue } = require('../../../utils/filter-values');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    getExperiencePayload,
    mapExperienceBody,
    validateRequiredExperiencePayload
} = require('./payload');

const router = express.Router();

/**
 * @swagger
 * /admin/experiences:
 *   get:
 *     summary: 경력 목록 조회
 *     tags:
 *       - Admin - Experiences
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: experiences.read.'
 *     parameters:
 *       - in: query
 *         name: type
 *         description: 생략하거나 비우면 모든 유형을 반환합니다.
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       type:
 *                         type: string
 *                         minLength: 1
 *                         example: work
 *                         description: 경력 유형. work, education, volunteer, certification 등의 문자열
 *                       title:
 *                         type: string
 *                         minLength: 1
 *                       company:
 *                         type: string
 *                         nullable: true
 *                         description: company_or_institution의 입력 별칭이며 둘 다 주면 company가 우선합니다.
 *                       company_or_institution:
 *                         type: string
 *                         nullable: true
 *                       location:
 *                         type: string
 *                         nullable: true
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       start_date:
 *                         type: string
 *                         nullable: true
 *                         format: date
 *                       end_date:
 *                         type: string
 *                         nullable: true
 *                         format: date
 *                       is_current:
 *                         type: integer
 *                         enum: [0, 1, null]
 *                         nullable: true
 *                         description: mysql2가 반환한 DB BOOLEAN 값으로 0, 1 또는 null입니다.
 *                       display_order:
 *                         type: integer
 *                         nullable: true
 *                     additionalProperties: true
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 필요한 권한 또는 역할 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: 경력 생성
 *     tags:
 *       - Admin - Experiences
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: experiences.create.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 minLength: 1
 *                 example: work
 *                 description: 경력 유형. work, education, volunteer, certification 등의 문자열
 *               title:
 *                 type: string
 *                 minLength: 1
 *               company:
 *                 type: string
 *                 nullable: true
 *                 description: company_or_institution의 입력 별칭이며 둘 다 주면 company가 우선합니다.
 *               company_or_institution:
 *                 type: string
 *                 nullable: true
 *               location:
 *                 type: string
 *                 nullable: true
 *               description:
 *                 type: string
 *                 nullable: true
 *               start_date:
 *                 type: string
 *                 nullable: true
 *                 format: date
 *               end_date:
 *                 type: string
 *                 nullable: true
 *                 format: date
 *               is_current:
 *                 type: boolean
 *                 nullable: true
 *               display_order:
 *                 type: integer
 *                 nullable: true
 *             required:
 *               - type
 *               - title
 *     responses:
 *       '201':
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     type:
 *                       type: string
 *                       minLength: 1
 *                       example: work
 *                       description: 경력 유형. work, education, volunteer, certification 등의 문자열
 *                     title:
 *                       type: string
 *                       minLength: 1
 *                     company:
 *                       type: string
 *                       nullable: true
 *                       description: company_or_institution의 입력 별칭이며 둘 다 주면 company가 우선합니다.
 *                     company_or_institution:
 *                       type: string
 *                       nullable: true
 *                     location:
 *                       type: string
 *                       nullable: true
 *                     description:
 *                       type: string
 *                       nullable: true
 *                     start_date:
 *                       type: string
 *                       nullable: true
 *                       format: date
 *                     end_date:
 *                       type: string
 *                       nullable: true
 *                       format: date
 *                     is_current:
 *                       type: integer
 *                       enum: [0, 1, null]
 *                       nullable: true
 *                       description: mysql2가 반환한 DB BOOLEAN 값으로 0, 1 또는 null입니다.
 *                     display_order:
 *                       type: integer
 *                       nullable: true
 *                   additionalProperties: true
 *       '400':
 *         description: 필수 값 누락 또는 유효하지 않은 입력
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
 *         description: 필요한 권한 또는 역할 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/experiences',
    authenticateToken,
    requirePermission('experiences.read'),
    async (req, res) => {
        try {
            const type = toStringValue(req.query.type).trim() || null;
            const experiences = type
                ? await Experiences.getByType(type)
                : await Experiences.getAll();

            res.json({
                success: true,
                data: experiences
            });
        } catch (error) {
            logger.error('관리자 경력 목록 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '경력 정보를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.post('/experiences',
    authenticateToken,
    requirePermission('experiences.create'),
    logActivity('create_experience'),
    async (req, res) => {
        try {
            const body = getExperiencePayload(req);
            const validationError = validateRequiredExperiencePayload(body);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            const mappedData = mapExperienceBody(body);
            const id = await Experiences.create(mappedData);
            const newExperience = await Experiences.getById(id);
            CacheUtils.invalidateResources('experiences');

            res.status(201).json({
                success: true,
                message: '경력이 추가되었습니다.',
                data: newExperience
            });
        } catch (error) {
            logger.error('관리자 경력 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '경력 추가에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
