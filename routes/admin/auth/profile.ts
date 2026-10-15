import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    AdminUsers,
    authenticateToken,
    buildErrorLog,
    getPasswordPolicyError,
    getPlainBody,
    hasRequiredStringFields,
    logActivity,
    logger,
    passwordChangeClientErrors
} = require('./common');

const router: Router = express.Router();

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);


/**
 * @swagger
 * /admin/me:
 *   get:
 *     summary: 내 관리자 계정과 권한 조회
 *     tags:
 *       - Admin - Profile
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: 인증된 관리자.'
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         username:
 *                           type: string
 *                         email:
 *                           type: string
 *                           format: email
 *                         full_name:
 *                           type: string
 *                           nullable: true
 *                         role:
 *                           type: string
 *                           enum:
 *                             - super_admin
 *                             - admin
 *                             - editor
 *                         is_active:
 *                           oneOf:
 *                             - type: boolean
 *                             - type: integer
 *                       additionalProperties: true
 *                       description: password_hash를 제외한 관리자 계정 정보
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           resource:
 *                             type: string
 *                           action:
 *                             type: string
 *                           description:
 *                             type: string
 *                             nullable: true
 *                         additionalProperties: true
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
 * /admin/password:
 *   put:
 *     summary: 내 관리자 비밀번호 변경
 *     tags:
 *       - Admin - Profile
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: 인증된 관리자. 기존 비밀번호를 확인하고 새 비밀번호로 변경합니다. 현재 세션을 제외한 다른 세션은 폐기합니다.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 minLength: 1
 *                 description: 현재 비밀번호. UTF-8 기준 72바이트 이하
 *               newPassword:
 *                 type: string
 *                 minLength: 12
 *                 maxLength: 72
 *                 description: 영문과 숫자를 포함한 12자 이상. UTF-8 인코딩 기준 72바이트 이하입니다.
 *                 example: NewStrongPass123
 *             required:
 *               - oldPassword
 *               - newPassword
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
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
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


router.put('/password', authenticateToken, logActivity('change_password'), async (req: Request, res: Response) => {
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
        const errorMessage = getErrorMessage(error);
        if (passwordChangeClientErrors.has(errorMessage)) {
            return res.status(400).json({
                success: false,
                message: errorMessage
            });
        }

        logger.error('비밀번호 변경 실패', buildErrorLog(error, req));
        return res.status(500).json({
            success: false,
            message: '비밀번호 변경 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router;
