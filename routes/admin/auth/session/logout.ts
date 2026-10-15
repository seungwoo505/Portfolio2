import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    AdminUsers,
    authenticateToken,
    logAuthActivitySafe,
    logger
} = require('../common');

const router: Router = express.Router();


/**
 * @swagger
 * /admin/logout:
 *   post:
 *     summary: 현재 관리자 세션 로그아웃
 *     tags:
 *       - Admin - Auth
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: 인증된 관리자. 요청 본문은 필요하지 않습니다. 인증된 현재 세션을 폐기합니다. 자동 갱신 후 로그아웃하는 경우 새 토큰 응답 헤더는 제거합니다.'
 *     parameters:
 *       - in: header
 *         name: X-Refresh-Token
 *         required: false
 *         description: 액세스 토큰 만료 시 자동 갱신에 사용할 리프레시 토큰. 새 토큰은 X-New-Token과 X-New-Refresh-Token 응답 헤더로 전달합니다.
 *         schema:
 *           type: string
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
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
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
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
    try {
        await AdminUsers.revokeSession(req.admin.sessionId);
        res.removeHeader('X-New-Token');
        res.removeHeader('X-New-Refresh-Token');

        await logAuthActivitySafe(req, {
            adminId: req.admin.id,
            action: 'admin_logout',
            details: '로그아웃'
        });

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
