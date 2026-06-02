const express = require('express');
const {
    AdminUsers,
    buildErrorLog,
    hasInvalidProvidedStringFields,
    isValidAdminRole,
    isValidEmail,
    logActivity,
    logger,
    normalizeUserUpdateBody,
    parsePositiveIntegerParam,
    superAdminOnly,
    getPlainBody
} = require('./common');

const router = express.Router();

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
 *     responses:
 *       200:
 *         description: 관리자 정보 수정 성공
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 관리자 없음
 *   delete:
 *     summary: 관리자 계정 삭제
 *     tags: ['Admin - Users']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 관리자 삭제 성공
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 관리자 없음
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
