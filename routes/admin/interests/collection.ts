const express = require('express');
const { logger, buildErrorLog } = require('../common');
const Interests = require('../../../models/interests');
const CacheUtils = require('../../../utils/cache');
const { toStringValue } = require('../../../utils/filter-values');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    getInterestPayload,
    validateCreateInterestPayload
} = require('./payload');

const router = express.Router();

/**
 * @swagger
 * /admin/interests:
 *   get:
 *     summary: 관심사 목록 조회
 *     tags:
 *       - Admin - Interests
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: interests.read.'
 *     parameters:
 *       - in: query
 *         name: category
 *         description: 생략하거나 비우면 모든 카테고리를 반환합니다.
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
 *                       title:
 *                         type: string
 *                         minLength: 1
 *                       category:
 *                         type: string
 *                         minLength: 1
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       icon:
 *                         type: string
 *                         nullable: true
 *                       display_order:
 *                         type: integer
 *                         default: 0
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
 *     summary: 관심사 생성
 *     tags:
 *       - Admin - Interests
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: interests.create.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *               category:
 *                 type: string
 *                 minLength: 1
 *               description:
 *                 type: string
 *                 nullable: true
 *               icon:
 *                 type: string
 *                 nullable: true
 *               display_order:
 *                 type: integer
 *                 default: 0
 *             required:
 *               - title
 *               - category
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
 *                     title:
 *                       type: string
 *                       minLength: 1
 *                     category:
 *                       type: string
 *                       minLength: 1
 *                     description:
 *                       type: string
 *                       nullable: true
 *                     icon:
 *                       type: string
 *                       nullable: true
 *                     display_order:
 *                       type: integer
 *                       default: 0
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
router.get('/interests',
    authenticateToken,
    requirePermission('interests.read'),
    async (req, res) => {
        try {
            const category = toStringValue(req.query.category).trim() || null;
            const interests = category
                ? await Interests.getByCategory(category)
                : await Interests.getAll();

            res.json({
                success: true,
                data: interests
            });
        } catch (error) {
            logger.error('관리자 관심사 목록 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '관심사 정보를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.post('/interests',
    authenticateToken,
    requirePermission('interests.create'),
    logActivity('create_interest'),
    async (req, res) => {
        try {
            const body = getInterestPayload(req);
            const validationError = validateCreateInterestPayload(body);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            const interest = await Interests.create(body);
            CacheUtils.invalidateResources('interests');

            res.status(201).json({
                success: true,
                message: '관심사가 생성되었습니다.',
                data: interest
            });
        } catch (error) {
            logger.error('관리자 관심사 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '관심사 생성에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
