const express = require('express');
const ActivityLogs = require('../../../models/activity-logs');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');
const { logger, buildErrorLog } = require('../common');
const { buildActivityLogsCsv, buildActivityLogsFilename } = require('./export');
const { normalizeLogFilters } = require('./filters');

const router = express.Router();


/**
 * @swagger
 * /admin/logs/export:
 *   get:
 *     summary: 관리자 활동 로그 CSV 내보내기
 *     tags:
 *       - Admin - Logs
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: logs.read. 지정한 필터에 맞는 최신 로그를 최대 10000개 내보냅니다.'
 *     parameters:
 *       - in: query
 *         name: search
 *         description: 사용자명·액션·리소스 유형·상세 내용에서 검색
 *         schema:
 *           type: string
 *       - in: query
 *         name: user
 *         description: 관리자 사용자명. all이면 제한 없음
 *         schema:
 *           type: string
 *           default: all
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           default: all
 *       - in: query
 *         name: resource_type
 *         schema:
 *           type: string
 *           default: all
 *       - in: query
 *         name: date_filter
 *         schema:
 *           type: string
 *           enum:
 *             - all
 *             - today
 *             - yesterday
 *             - week
 *             - month
 *           default: all
 *     responses:
 *       '200':
 *         description: CSV 파일
 *         headers:
 *           Content-Disposition:
 *             description: attachment; filename="activity-logs-<timestamp>.csv"
 *             schema:
 *               type: string
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
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
router.get('/logs/export',
    authenticateToken,
    requirePermission('logs.read'),
    async (req, res) => {
        try {
            const filters = {
                ...normalizeLogFilters(req.query),
                page: 1,
                limit: 10000
            };
            const logs = await ActivityLogs.findWithFilters(filters);
            const csvContent = buildActivityLogsCsv(logs);
            const filename = buildActivityLogsFilename();

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csvContent);

        } catch (error) {
            logger.error('활동 로그 내보내기 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '활동 로그 내보내기에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
