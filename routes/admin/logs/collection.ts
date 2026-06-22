const express = require('express');
const ActivityLogs = require('../../../models/activity-logs');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');
const { parsePagination } = require('../../../utils/pagination');
const { logger, buildErrorLog } = require('../common');
const { normalizeLogFilters } = require('./filters');

const router = express.Router();

router.get('/logs',
    authenticateToken,
    requirePermission('logs.read'),
    async (req, res) => {
        try {
            const pagination = parsePagination(req.query, {
                defaultLimit: 50,
                maxLimit: 1000
            });

            const filters = {
                ...normalizeLogFilters(req.query),
                limit: pagination.limit,
                offset: pagination.offset
            };
            const logs = await ActivityLogs.findWithFilters(filters);
            const total = await ActivityLogs.countWithFilters(filters);
            const pages = Math.ceil(total / pagination.limit);

            res.json({
                success: true,
                data: logs,
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total,
                    pages,
                    totalPages: pages
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

module.exports = router;
export {};
