const express = require('express');
const {
    AdminUsers,
    buildErrorLog,
    getPasswordPolicyError,
    getPlainBody,
    hasRequiredStringFields,
    isValidAdminRole,
    isValidEmail,
    logActivity,
    logger,
    superAdminOnly,
    trimStringFields,
    userCreateClientErrors,
    userStringFields
} = require('./common');

const router = express.Router();

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: 관리자 계정 목록 조회
 *     tags: ['Admin - Users']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 관리자 목록 조회 성공
 *   post:
 *     summary: 관리자 계정 생성
 *     tags: ['Admin - Users']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: 관리자 생성 성공
 *       400:
 *         description: 잘못된 요청
 */
router.get('/users', ...superAdminOnly, async (req, res) => {
    try {
        const users = await AdminUsers.getAll();
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '관리자 목록을 가져오는데 실패했습니다.'
        });
    }
});

router.post('/users', ...superAdminOnly, logActivity('create_admin'), async (req, res) => {
    try {
        const body = trimStringFields(getPlainBody(req), userStringFields);
        const { username, email, password, full_name } = body;
        const role = body.role || 'admin';

        if (!hasRequiredStringFields({ username, email, password }, ['username', 'email', 'password'])) {
            return res.status(400).json({
                success: false,
                message: '사용자명, 이메일, 비밀번호는 필수입니다.'
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: '올바른 이메일 형식이 아닙니다.'
            });
        }

        if (!isValidAdminRole(role)) {
            return res.status(400).json({
                success: false,
                message: '관리자 역할이 올바르지 않습니다.'
            });
        }

        const passwordPolicyError = getPasswordPolicyError(password);
        if (passwordPolicyError) {
            return res.status(400).json({
                success: false,
                message: passwordPolicyError
            });
        }

        const id = await AdminUsers.create({
            username,
            email,
            password,
            full_name,
            role
        });

        const newUser = await AdminUsers.getById(id);

        res.status(201).json({
            success: true,
            message: '관리자가 생성되었습니다.',
            data: newUser
        });
    } catch (error) {
        if (userCreateClientErrors.has(error.message)) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        logger.error('관리자 생성 실패', buildErrorLog(error, req, {
            username: req.body?.username,
            email: req.body?.email
        }));

        return res.status(500).json({
            success: false,
            message: '관리자 생성에 실패했습니다.'
        });
    }
});

module.exports = router;
