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

const router = express.Router();

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
        if (passwordChangeClientErrors.has(error.message)) {
            return res.status(400).json({
                success: false,
                message: error.message
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
