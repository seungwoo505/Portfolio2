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
 *     tags:
 *       - Admin - Users
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: super_admin 역할.'
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       username:
 *                         type: string
 *                       email:
 *                         type: string
 *                         format: email
 *                       full_name:
 *                         type: string
 *                         nullable: true
 *                       role:
 *                         type: string
 *                         enum:
 *                           - super_admin
 *                           - admin
 *                           - editor
 *                       is_active:
 *                         oneOf:
 *                           - type: boolean
 *                           - type: integer
 *                     additionalProperties: true
 *                     description: password_hash를 제외한 관리자 계정 정보
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 필요한 권한 또는 역할 없음
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
 *   post:
 *     summary: 관리자 계정 생성
 *     tags:
 *       - Admin - Users
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: super_admin 역할.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 1
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 12
 *                 maxLength: 72
 *                 description: 영문과 숫자를 포함한 12자 이상. UTF-8 인코딩 기준 72바이트 이하입니다.
 *                 example: NewStrongPass123
 *               full_name:
 *                 type: string
 *                 nullable: true
 *               role:
 *                 type: string
 *                 enum:
 *                   - super_admin
 *                   - admin
 *                   - editor
 *                 default: admin
 *             required:
 *               - username
 *               - email
 *               - password
 *     responses:
 *       '201':
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     full_name:
 *                       type: string
 *                       nullable: true
 *                     role:
 *                       type: string
 *                       enum:
 *                         - super_admin
 *                         - admin
 *                         - editor
 *                     is_active:
 *                       oneOf:
 *                         - type: boolean
 *                         - type: integer
 *                   additionalProperties: true
 *                   description: password_hash를 제외한 관리자 계정 정보
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
 *       '403':
 *         description: 필요한 권한 또는 역할 없음
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
