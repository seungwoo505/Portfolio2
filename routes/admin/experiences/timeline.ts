const express = require('express');
const { logger, buildErrorLog } = require('../common');
const Experiences = require('../../../models/experiences');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /admin/experiences/timeline:
 *   get:
 *     summary: 경력 타임라인 조회
 *     tags:
 *       - Admin - Experiences
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: experiences.read. 현재 진행 중 여부와 종료일·시작일 순으로 반환합니다.'
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
 *                       start_date_formatted:
 *                         type: string
 *                         nullable: true
 *                       end_date_formatted:
 *                         type: string
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
 */
router.get('/experiences/timeline',
    authenticateToken,
    requirePermission('experiences.read'),
    async (req, res) => {
        try {
            const timeline = await Experiences.getTimeline();
            res.json({
                success: true,
                data: timeline
            });
        } catch (error) {
            logger.error('관리자 타임라인 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '타임라인 정보를 가져오는데 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
