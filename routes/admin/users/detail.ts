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
    getUpdateUserPayload,
    validateUpdateUserPayload
} = require('./payload');
const {
    ensureUserCanBeDeleted,
    findUserById,
    parseUserIdParam
} = require('./lookup');

const router: Router = express.Router();

type UserRouteError = {
    statusCode: number;
    message: string;
};

const sendRouteError = (res: Response, error: UserRouteError) => (
    res.status(error.statusCode).json({
        success: false,
        message: error.message
    })
);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: 관리자 계정 상세 조회
 *     tags:
 *       - Admin - Users
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: super_admin 역할.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 대상의 양의 정수 ID
 *         schema:
 *           type: integer
 *           minimum: 1
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
 *       '404':
 *         description: 대상을 찾을 수 없음
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
 *   put:
 *     summary: 관리자 계정 일부 수정
 *     tags:
 *       - Admin - Users
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: super_admin 역할. 보낸 필드만 수정합니다. 비밀번호를 변경하면 해당 계정의 모든 세션을 폐기합니다.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 대상의 양의 정수 ID
 *         schema:
 *           type: integer
 *           minimum: 1
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
 *               is_active:
 *                 oneOf:
 *                   - type: boolean
 *                   - type: integer
 *                     enum:
 *                       - 0
 *                       - 1
 *                   - type: string
 *                     enum:
 *                       - 'true'
 *                       - 'false'
 *                       - '1'
 *                       - '0'
 *                       - 'yes'
 *                       - 'no'
 *                       - 'on'
 *                       - 'off'
 *                 description: boolean 또는 대응하는 숫자·문자열을 허용합니다.
 *             minProperties: 1
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
 *       '404':
 *         description: 대상을 찾을 수 없음
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
 *   delete:
 *     summary: 관리자 계정 삭제
 *     tags:
 *       - Admin - Users
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: super_admin 역할. 자신의 계정은 삭제할 수 없습니다.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 대상의 양의 정수 ID
 *         schema:
 *           type: integer
 *           minimum: 1
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
 *       '403':
 *         description: 필요한 권한 또는 역할 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 대상을 찾을 수 없음
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
router.get('/users/:id', ...superAdminOnly, async (req: Request, res: Response) => {
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


router.put('/users/:id', ...superAdminOnly, logActivity('update_admin'), async (req: Request, res: Response) => {
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
        if (error instanceof Error && userCreateClientErrors.has(error.message)) {
            return res.status(400).json({ success: false, message: error.message });
        }
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

router.delete('/users/:id', ...superAdminOnly, logActivity('delete_admin'), async (req: Request, res: Response) => {
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
