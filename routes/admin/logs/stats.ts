const express = require('express');
const ActivityLogs = require('../../../models/activity-logs');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');
const { logger, buildErrorLog } = require('../common');

const router = express.Router();

/**
 * @swagger
 * /admin/logs/stats:
 *   get:
 *     summary: 관리자 활동 로그 전체 통계
 *     tags:
 *       - Admin - Logs
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: logs.read.'
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
 *                   type: object
 *                   properties:
 *                     total:
 *                       oneOf:
 *                         - type: integer
 *                         - type: string
 *                           nullable: true
 *                       description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                     today:
 *                       oneOf:
 *                         - type: integer
 *                         - type: string
 *                           nullable: true
 *                       description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                     uniqueUsers:
 *                       oneOf:
 *                         - type: integer
 *                         - type: string
 *                           nullable: true
 *                       description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                     uniqueResources:
 *                       oneOf:
 *                         - type: integer
 *                         - type: string
 *                           nullable: true
 *                       description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
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
router.get('/logs/stats',
    authenticateToken,
    requirePermission('logs.read'),
    async (req, res) => {
        try {
            const stats = await ActivityLogs.getStats();

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            logger.error('활동 로그 통계 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '활동 로그 통계를 가져오는데 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
