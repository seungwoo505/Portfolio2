const express = require('express');
const router = express.Router();
const { logger, buildErrorLog } = require('./common');
const AdminUsers = require('../../models/admin-users');
const { logActivity, superAdminOnly } = require('../../middleware/auth');
const { toBooleanOrNull } = require('../../utils/filter-values');
const { parsePositiveIntegerParam } = require('../../utils/route-params');
const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../utils/request-body');
const {
    getPasswordPolicyError,
    isValidAdminRole,
    isValidEmail
} = require('../../utils/admin-validation');

const userStringFields = ['username', 'email', 'full_name', 'role'];
const normalizeUserUpdateBody = (body) => {
    const normalizedBody = trimStringFields(body, userStringFields);

    if (Object.prototype.hasOwnProperty.call(normalizedBody, 'is_active')) {
        normalizedBody.is_active = toBooleanOrNull(normalizedBody.is_active);
    }

    return normalizedBody;
};
const userCreateClientErrors = new Set([
    '이미 존재하는 사용자명 또는 이메일입니다.'
]);

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     additionalProperties: true
 *   post:
 *     summary: 관리자 계정 생성
 *     tags: ['Admin - Users']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "new-admin"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@company.com"
 *               password:
 *                 type: string
 *                 example: "StrongPass!123"
 *               full_name:
 *                 type: string
 *                 example: "관리자 홍길동"
 *               role:
 *                 type: string
 *                 example: "admin"
 *     responses:
 *       201:
 *         description: 관리자 생성 성공
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
 *                   example: "관리자가 생성되었습니다."
 *                 data:
 *                   type: object
 *                   additionalProperties: true
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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

router.get('/users/:id', ...superAdminOnly, async (req, res) => {
    try {
        const userId = parsePositiveIntegerParam(req.params.id);
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: '유효한 사용자 ID가 필요합니다.'
            });
        }

        const user = await AdminUsers.getById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        logger.error('사용자 정보 조회 실패', buildErrorLog(error, req, {
            userId: req.params.id
        }));

        res.status(500).json({
            success: false,
            message: '사용자 정보를 가져오는데 실패했습니다.'
        });
    }
});

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: 관리자 계정 수정
 *     tags: ['Admin - Users']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: 관리자 정보 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   additionalProperties: true
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 관리자 없음
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
 *   delete:
 *     summary: 관리자 계정 삭제
 *     tags: ['Admin - Users']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 관리자 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 관리자 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/users/:id', ...superAdminOnly, logActivity('update_admin'), async (req, res) => {
    try {
        const userId = parsePositiveIntegerParam(req.params.id);
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: '유효한 사용자 ID가 필요합니다.'
            });
        }

        const body = normalizeUserUpdateBody(getPlainBody(req));

        if (Object.keys(body).length === 0) {
            return res.status(400).json({
                success: false,
                message: '수정할 관리자 정보가 필요합니다.'
            });
        }

        if (hasInvalidProvidedStringFields(body, ['username', 'email', 'role'])) {
            return res.status(400).json({
                success: false,
                message: '사용자명, 이메일, 역할은 비어 있을 수 없습니다.'
            });
        }

        if (body.email && !isValidEmail(body.email)) {
            return res.status(400).json({
                success: false,
                message: '올바른 이메일 형식이 아닙니다.'
            });
        }

        if (body.role && !isValidAdminRole(body.role)) {
            return res.status(400).json({
                success: false,
                message: '관리자 역할이 올바르지 않습니다.'
            });
        }

        if (Object.prototype.hasOwnProperty.call(body, 'is_active') && body.is_active === null) {
            return res.status(400).json({
                success: false,
                message: '활성 상태는 boolean 값이어야 합니다.'
            });
        }

        const existingUser = await AdminUsers.getById(userId);
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        const updatedUser = await AdminUsers.update(userId, body);

        res.json({
            success: true,
            message: '관리자 정보가 수정되었습니다.',
            data: updatedUser
        });
    } catch (error) {
        logger.error('사용자 정보 수정 실패', buildErrorLog(error, req, {
            userId: req.params.id,
            requestBody: req.body
        }));

        res.status(500).json({
            success: false,
            message: '관리자 정보 수정에 실패했습니다.'
        });
    }
});

router.delete('/users/:id', ...superAdminOnly, logActivity('delete_admin'), async (req, res) => {
    try {
        const userId = parsePositiveIntegerParam(req.params.id);

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: '유효한 사용자 ID가 필요합니다.'
            });
        }

        if (userId === Number(req.admin.id)) {
            return res.status(400).json({
                success: false,
                message: '자신의 계정은 삭제할 수 없습니다.'
            });
        }

        const userToDelete = await AdminUsers.getById(userId);
        if (!userToDelete) {
            return res.status(404).json({
                success: false,
                message: '삭제할 사용자를 찾을 수 없습니다.'
            });
        }

        await AdminUsers.delete(userId);

        res.json({
            success: true,
            message: '관리자가 삭제되었습니다.'
        });
    } catch (error) {
        logger.error('사용자 삭제 실패', buildErrorLog(error, req, {
            userId: req.params.id
        }));

        res.status(500).json({
            success: false,
            message: '관리자 삭제에 실패했습니다.'
        });
    }
});

module.exports = router;
