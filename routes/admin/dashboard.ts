const express = require('express');
const router = express.Router();
const AdminActivityLogs = require('../../models/admin-activity-logs');
const ContactMessages = require('../../models/contact-messages');
const { executeQuery } = require('../../models/db-utils');
const { authenticateToken, requirePermission } = require('../../middleware/auth');


/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: 관리자 대시보드 통계 조회
 *     tags:
 *       - Admin - Dashboard
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: dashboard.read.'
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
 *                     blog:
 *                       type: object
 *                       properties:
 *                         total:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         published:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         drafts:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                     projects:
 *                       type: object
 *                       properties:
 *                         total:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         featured:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                     contacts:
 *                       type: object
 *                       properties:
 *                         total:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         unread:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         unreplied:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         today:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         this_week:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         this_month:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                     activities:
 *                       type: object
 *                       properties:
 *                         total_activities:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         active_admins:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         active_days:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         creates:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         updates:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         deletes:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         today:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
 *                         this_week:
 *                           oneOf:
 *                             - type: integer
 *                             - type: string
 *                               nullable: true
 *                           description: DB 집계값입니다. DB 드라이버에 따라 문자열이며 SUM 결과는 null일 수 있습니다.
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
router.get('/dashboard', authenticateToken, requirePermission('dashboard.read'), async (req, res) => {
    try {
        const [
            blogStats,
            projectStats,
            contactStats,
            activityStats
        ] = await Promise.all([
            executeQuery(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) as published,
                    SUM(CASE WHEN is_published = 0 THEN 1 ELSE 0 END) as drafts
                FROM blog_posts
            `).then(result => ({
                total: result[0].total,
                published: result[0].published,
                drafts: result[0].drafts
            })),
            executeQuery(`
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) as featured
                FROM projects
            `).then(result => ({
                total: result[0].total,
                featured: result[0].featured
            })),
            ContactMessages.getStats(),
            AdminActivityLogs.getStats(7) // 7일간 활동
        ]);

        res.json({
            success: true,
            data: {
                blog: blogStats,
                projects: projectStats,
                contacts: contactStats,
                activities: activityStats
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '대시보드 데이터를 가져오는데 실패했습니다.'
        });
    }
});

module.exports = router;

export {};
