const express = require('express');
const router = express.Router();
const { logger, buildErrorLog } = require('./common');
const AdminUsers = require('../../models/admin-users');
const AdminActivityLogs = require('../../models/admin-activity-logs');
const { authenticateToken, logActivity } = require('../../middleware/auth');
const { getPlainBody, hasRequiredStringFields, trimStringFields } = require('../../utils/request-body');
const { getPasswordPolicyError } = require('../../utils/admin-validation');

const genericLoginFailureMessage = '사용자명 또는 비밀번호가 올바르지 않습니다.';
const genericRefreshFailureMessage = 'Refresh Token이 유효하지 않거나 만료되었습니다.';

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

        await AdminActivityLogs.log(
            result.user.id,
            'admin_login',
            'auth',
            null,
            `${username} 로그인`,
            req.ip,
            req.headers['user-agent']
        );

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
        await AdminActivityLogs.log(
            null,
            'admin_login_failed',
            'auth',
            null,
            `${username || 'unknown'} 로그인 실패`,
            req.ip,
            req.headers['user-agent']
        );

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

/**
 * @swagger
 * /api/admin/refresh:
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

/**
 * @swagger
 * /api/admin/me:
 *   get:
 *     summary: 내 관리자 정보 조회
 *     tags: ['Admin - Profile']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 사용자 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
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
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await AdminUsers.getById(req.admin.id);
        const permissions = await AdminUsers.getUserPermissions(req.admin.id);

        res.json({
            success: true,
            data: {
                user,
                permissions
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '사용자 정보를 가져오는데 실패했습니다.'
        });
    }
});

/**
 * @swagger
 * /api/admin/password:
 *   put:
 *     summary: 관리자 비밀번호 변경
 *     tags: ['Admin - Profile']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 example: "CurrentStrongPass!2026"
 *               newPassword:
 *                 type: string
 *                 example: "NewStrongPass!2026"
 *     responses:
 *       200:
 *         description: 비밀번호 변경 성공
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
 *                   example: "비밀번호가 변경되었습니다."
 *       400:
 *         description: 잘못된 요청
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
router.put('/password', authenticateToken, logActivity('change_password'), async (req, res) => {
    try {
        const { oldPassword, newPassword } = getPlainBody(req);

        if (!hasRequiredStringFields({ oldPassword, newPassword }, ['oldPassword', 'newPassword'])) {
            return res.status(400).json({
                success: false,
                message: '기존 비밀번호와 새 비밀번호를 입력해주세요.'
            });
        }

        const passwordPolicyError = getPasswordPolicyError(newPassword);
        if (passwordPolicyError) {
            return res.status(400).json({
                success: false,
                message: passwordPolicyError
            });
        }

        await AdminUsers.changePassword(req.admin.id, oldPassword, newPassword, req.admin.sessionId);

        res.json({
            success: true,
            message: '비밀번호가 변경되었습니다.'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
