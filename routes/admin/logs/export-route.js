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
 *     summary: 활동 로그 CSV 내보내기
 *     tags: ['Admin - Logs']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: date_filter
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV 파일 반환
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       500:
 *         description: 서버 오류
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
