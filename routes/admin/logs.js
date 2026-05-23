const express = require('express');
const router = express.Router();
const { logger, buildErrorLog } = require('./common');
const ActivityLogs = require('../../models/activity-logs');
const { authenticateToken, requirePermission } = require('../../middleware/auth');

router.get('/logs',
    authenticateToken,
    requirePermission('logs.read'),
    async (req, res) => {
        try {
            const {
                search = '',
                user = 'all',
                action = 'all',
                resource_type = 'all',
                date_filter = 'all',
                page = 1,
                limit = 50
            } = req.query;
            const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
            const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 1000);

            const filters = {
                search,
                user,
                action,
                resource_type,
                date_filter,
                page: pageNumber,
                limit: pageLimit
            };
            const logs = await ActivityLogs.findWithFilters(filters);
            const total = await ActivityLogs.countWithFilters(filters);

            res.json({
                success: true,
                data: logs,
                pagination: {
                    page: pageNumber,
                    limit: pageLimit,
                    total,
                    pages: Math.ceil(total / pageLimit)
                }
            });

        } catch (error) {
            logger.error('활동 로그 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '활동 로그를 가져오는데 실패했습니다.'
            });
        }
    }
);

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

/**
 * @swagger
 * /api/admin/logs/export:
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
            const {
                search = '',
                user = 'all',
                action = 'all',
                resource_type = 'all',
                date_filter = 'all'
            } = req.query;

            const filters = {
                search,
                user,
                action,
                resource_type,
                date_filter,
                page: 1,
                limit: 10000 // 최대 10,000개 로그 내보내기
            };
            const logs = await ActivityLogs.findWithFilters(filters);

            const csvHeaders = [
                'ID', '사용자 ID', '사용자명', '액션', '리소스 타입',
                '리소스 ID', '리소스명', '상세정보', 'IP 주소', 'OS + 브라우저', '생성일'
            ];

            const csvData = logs.map(log => [
                log.id,
                log.user_id,
                log.username,
                log.action,
                log.resource_type,
                log.resource_id || '',
                log.resource_name || '',
                log.details || '',
                log.ip_address || '',
                log.user_agent || '',
                new Date(log.created_at).toLocaleString('ko-KR')
            ]);

            const csvContent = [
                csvHeaders.join(','),
                ...csvData.map(row => row.map(field => `"${field}"`).join(','))
            ].join('\n');

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `activity-logs-${timestamp}.csv`;

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

