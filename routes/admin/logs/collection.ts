const express = require('express');
const ActivityLogs = require('../../../models/activity-logs');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');
const { parsePagination } = require('../../../utils/pagination');
const { logger, buildErrorLog } = require('../common');
const { normalizeLogFilters } = require('./filters');

const router = express.Router();

/**
 * @swagger
 * /admin/logs:
 *   get:
 *     summary: 관리자 활동 로그 목록 조회
 *     tags:
 *       - Admin - Logs
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: logs.read.'
 *     parameters:
 *       - in: query
 *         name: page
 *         description: 잘못된 값은 기본값을 사용하고 범위를 벗어나면 경곗값으로 보정합니다.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           default: 1
 *       - in: query
 *         name: limit
 *         description: 페이지당 항목 수
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 50
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
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           user_id:
 *                             type: integer
 *                             nullable: true
 *                           username:
 *                             type: string
 *                             nullable: true
 *                           action:
 *                             type: string
 *                           resource_type:
 *                             type: string
 *                             nullable: true
 *                           resource_id:
 *                             type: string
 *                             nullable: true
 *                           resource_name:
 *                             type: string
 *                             nullable: true
 *                           details:
 *                             type: string
 *                             nullable: true
 *                           ip_address:
 *                             type: string
 *                             nullable: true
 *                           user_agent:
 *                             type: string
 *                             nullable: true
 *                           created_at:
 *                             type: string
 *                             description: DB 날짜 문자열(YYYY-MM-DD HH:mm:ss)
 *                             example: '2026-10-15 12:00:00'
 *                         additionalProperties: true
 *                 - type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                         pages:
 *                           type: integer
 *                           description: totalPages와 같은 값
 *                         totalPages:
 *                           type: integer
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
