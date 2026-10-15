import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    AdminUsers,
    buildErrorLog,
    genericRefreshFailureMessage,
    getPlainBody,
    logger
} = require('../common');

const router: Router = express.Router();


/**
 * @swagger
 * /admin/refresh:
 *   post:
 *     summary: 액세스·리프레시 토큰 갱신
 *     tags:
 *       - Admin - Auth
 *     security: []
 *     description: 유효한 서버 세션과 발급 IP를 확인하고 리프레시 토큰을 교체합니다. 교체 전 토큰은 다시 사용할 수 없습니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 minLength: 1
 *             required:
 *               - refreshToken
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
 *                     token:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       '400':
 *         description: 필수 값 누락 또는 유효하지 않은 입력
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', async (req: Request, res: Response) => {
    const isRequestActive = () => !req.aborted && !res.headersSent && !res.writableEnded && !res.destroyed;
    try {
        if (!isRequestActive()) return;
        const { refreshToken } = getPlainBody(req);

        if (typeof refreshToken !== 'string' || !refreshToken.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Refresh Token이 필요합니다.'
            });
        }

        const decoded = AdminUsers.verifyRefreshToken(refreshToken);

        const clientIP = req.ip || req.connection.remoteAddress;
        if (decoded.ip && decoded.ip !== clientIP) {
            logger.warn('토큰 재발급 실패 - IP 불일치', {
                requestId: req.requestId,
                adminId: decoded.id,
                ip: clientIP
            });

            return res.status(401).json({
                success: false,
                message: genericRefreshFailureMessage
            });
        }

        const user = await AdminUsers.getById(decoded.id);
        if (!isRequestActive()) return;
        if (!user || !user.is_active) {
            logger.warn('토큰 재발급 실패 - 비활성 사용자', {
                requestId: req.requestId,
                adminId: decoded.id,
                ip: clientIP
            });

            return res.status(401).json({
                success: false,
                message: genericRefreshFailureMessage
            });
        }

        const newRefreshToken = await AdminUsers.rotateRefreshSession(
            refreshToken, decoded, user, clientIP, isRequestActive
        );
        if (!isRequestActive()) return;
        const newToken = AdminUsers.generateToken(user, clientIP, decoded.sid);

        res.json({
            success: true,
            message: '토큰이 재발급되었습니다.',
            data: {
                token: newToken,
                refreshToken: newRefreshToken
            }
        });
    } catch (error) {
        if (!isRequestActive()) return;
        logger.warn('토큰 재발급 실패', buildErrorLog(error, req));
        res.status(401).json({
            success: false,
            message: genericRefreshFailureMessage
        });
    }
});

module.exports = router;
