import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    AdminUsers,
    buildErrorLog,
    logActivity,
    logger,
    superAdminOnly,
    userCreateClientErrors
} = require('./common');
const {
    getCreateUserPayload,
    validateCreateUserPayload
} = require('./payload');

const router: Router = express.Router();

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

/**
 * @swagger
 * /admin/users:
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
router.get('/users', ...superAdminOnly, async (req: Request, res: Response) => {
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

router.post('/users', ...superAdminOnly, logActivity('create_admin'), async (req: Request, res: Response) => {
    try {
        const payload = getCreateUserPayload(req);
        const validationError = validateCreateUserPayload(payload);
        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const id = await AdminUsers.create(payload);

        const newUser = await AdminUsers.getById(id);

        res.status(201).json({
            success: true,
            message: '관리자가 생성되었습니다.',
            data: newUser
        });
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        if (userCreateClientErrors.has(errorMessage)) {
            return res.status(400).json({
                success: false,
                message: errorMessage
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
