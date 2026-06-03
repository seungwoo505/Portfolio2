const express = require('express');
const {
    AdminUsers,
    buildErrorLog,
    logActivity,
    logger,
    superAdminOnly
} = require('./common');
const {
    getUpdateUserPayload,
    validateUpdateUserPayload
} = require('./payload');
const {
    ensureUserCanBeDeleted,
    findUserById,
    parseUserIdParam
} = require('./lookup');

const router = express.Router();

const sendRouteError = (res, error) => (
    res.status(error.statusCode).json({
        success: false,
        message: error.message
    })
);

router.get('/users/:id', ...superAdminOnly, async (req, res) => {
    try {
        const parsed = parseUserIdParam(req.params.id);
        if (parsed.error) {
            return sendRouteError(res, parsed.error);
        }

        const lookup = await findUserById(parsed.userId);
        if (lookup.error) {
            return sendRouteError(res, lookup.error);
        }

        res.json({
            success: true,
            data: lookup.user
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
        const parsed = parseUserIdParam(req.params.id);
        if (parsed.error) {
            return sendRouteError(res, parsed.error);
        }

        const body = getUpdateUserPayload(req);
        const validationError = validateUpdateUserPayload(body);
        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const lookup = await findUserById(parsed.userId);
        if (lookup.error) {
            return sendRouteError(res, lookup.error);
        }

        const updatedUser = await AdminUsers.update(parsed.userId, body);

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
        const parsed = parseUserIdParam(req.params.id);
        if (parsed.error) {
            return sendRouteError(res, parsed.error);
        }

        const deletionCheck = ensureUserCanBeDeleted(parsed.userId, req.admin.id);
        if (deletionCheck.error) {
            return sendRouteError(res, deletionCheck.error);
        }

        const lookup = await findUserById(parsed.userId, '삭제할 사용자를 찾을 수 없습니다.');
        if (lookup.error) {
            return sendRouteError(res, lookup.error);
        }

        await AdminUsers.delete(parsed.userId);

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
