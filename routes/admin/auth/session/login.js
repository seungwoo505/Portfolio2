const express = require('express');
const {
    AdminUsers,
    buildErrorLog,
    genericLoginFailureMessage,
    getPlainBody,
    hasRequiredStringFields,
    logAuthActivitySafe,
    logger,
    trimStringFields
} = require('../common');

const router = express.Router();

/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     summary: 관리자 로그인
 *     description: 관리자 계정으로 로그인하여 JWT 토큰을 발급받습니다.
 *     tags: ['Admin - Auth']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: 너무 많은 로그인 시도
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', async (req, res) => {
    const body = trimStringFields(getPlainBody(req), ['username']);
    const username = body.username;
    const password = body.password;

    try {
        if (!hasRequiredStringFields({ username, password }, ['username', 'password'])) {
            return res.status(400).json({
                success: false,
                message: '사용자명과 비밀번호를 입력해주세요.'
            });
        }

        const result = await AdminUsers.login(
            username,
            password,
            req.ip,
            req.headers['user-agent']
        );

        await logAuthActivitySafe(req, {
            adminId: result.user.id,
            action: 'admin_login',
            details: `${username} 로그인`
        });

        logger.activity('관리자 로그인 성공', {
            username,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            loginTime: new Date().toISOString()
        }, result.user);

        logger.incrementCounter('loginSuccess');

        res.json({
            success: true,
            message: '로그인되었습니다.',
            data: result
        });
    } catch (error) {
        await logAuthActivitySafe(req, {
            action: 'admin_login_failed',
            details: `${username || 'unknown'} 로그인 실패`
        });

        logger.activity('관리자 로그인 실패', {
            username,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            error: error.message,
            attemptTime: new Date().toISOString()
        });

        logger.warn('관리자 로그인 실패', buildErrorLog(error, req, {
            username
        }));

        res.status(401).json({
            success: false,
            message: genericLoginFailureMessage
        });
    }
});

module.exports = router;
