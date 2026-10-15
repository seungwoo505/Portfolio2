import type { Request, Response, Router } from 'express';

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

const router: Router = express.Router();

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);


/**
 * @swagger
 * /admin/login:
 *   post:
 *     summary: 관리자 로그인
 *     tags:
 *       - Admin - Auth
 *     security: []
 *     description: 사용자명 또는 이메일과 비밀번호로 로그인합니다. 비밀번호는 UTF-8 기준 72바이트 이하여야 합니다. 실패 사유는 공통 인증 실패 메시지로 반환합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       '200':
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
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
 *       '429':
 *         description: 요청 제한 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', async (req: Request, res: Response) => {
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
        const permissions = await AdminUsers.getUserPermissions(result.user.id);

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
            data: {
                ...result,
                permissions
            }
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
            error: getErrorMessage(error),
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
