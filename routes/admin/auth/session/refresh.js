const express = require('express');
const {
    AdminUsers,
    buildErrorLog,
    genericRefreshFailureMessage,
    getPlainBody,
    logger
} = require('../common');

const router = express.Router();

/**
 * @swagger
 * /admin/refresh:
 *   post:
 *     summary: 액세스 토큰 재발급
 *     tags: ['Admin - Auth']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: 토큰 재발급 성공
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
 *                   example: "토큰이 재발급되었습니다."
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIs..."
 *                     refreshToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIs..."
 *       400:
 *         description: Refresh Token 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', async (req, res) => {
    try {
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

        const newRefreshToken = await AdminUsers.rotateRefreshSession(refreshToken, decoded, user, clientIP);
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
        logger.warn('토큰 재발급 실패', buildErrorLog(error, req));
        res.status(401).json({
            success: false,
            message: genericRefreshFailureMessage
        });
    }
});

module.exports = router;
