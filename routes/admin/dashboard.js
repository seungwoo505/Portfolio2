const express = require('express');
const router = express.Router();
const AdminActivityLogs = require('../../models/admin-activity-logs');
const ContactMessages = require('../../models/contact-messages');
const { executeQuery } = require('../../models/db-utils');
const { authenticateToken, requirePermission } = require('../../middleware/auth');

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: 관리자 대시보드 통계
 *     description: 블로그, 프로젝트, 연락처 메시지, 관리자 활동 등의 통계 정보를 조회합니다.
 *     tags: ['Admin - Dashboard']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 대시보드 통계 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStats'
 *       401:
 *         description: 인증되지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 권한 없음
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

