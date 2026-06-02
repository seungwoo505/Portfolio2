const express = require('express');
const {
    AdminActivityLogs,
    AdminUsers,
    authenticateToken,
    logger
} = require('../common');

const router = express.Router();

/**
 * @swagger
 * /api/admin/logout:
 *   post:
 *     summary: 관리자 로그아웃
 *     tags: ['Admin - Auth']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 로그아웃 성공
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
 *                   example: "로그아웃되었습니다."
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const token = req.headers['authorization'].split(' ')[1];
        await AdminUsers.logout(token);

        await AdminActivityLogs.log(
            req.admin.id,
            'admin_logout',
            'auth',
            null,
            '로그아웃',
            req.ip,
            req.headers['user-agent']
        );

        logger.activity('관리자 로그아웃', {
            username: req.admin.username,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            logoutTime: new Date().toISOString()
        }, req.admin);

        res.json({
            success: true,
            message: '로그아웃되었습니다.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '로그아웃 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router;
