const express = require('express');
const { logger, buildErrorLog } = require('../common');
const ContactMessages = require('../../../models/contact-messages');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');

const router = express.Router();


/**
 * @swagger
 * /admin/contacts/{id}/read:
 *   put:
 *     summary: 문의 메시지 읽음 처리
 *     tags:
 *       - Admin - Contacts
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: contacts.update. 요청 본문은 필요하지 않습니다.'
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
 *                   properties: {}
 *                   additionalProperties: true
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
 * /admin/contacts/{id}:
 *   delete:
 *     summary: 문의 메시지 삭제
 *     tags:
 *       - Admin - Contacts
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: contacts.delete.'
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
router.put('/contacts/:id/read',
    authenticateToken,
    requirePermission('contacts.update'),
    logActivity('mark_contact_read'),
    async (req, res) => {
        try {
            const messageId = parsePositiveIntegerParam(req.params.id);
            if (!messageId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 메시지 ID가 필요합니다.'
                });
            }

            const existingMessage = await ContactMessages.getById(messageId);
            if (!existingMessage) {
                return res.status(404).json({
                    success: false,
                    message: '메시지를 찾을 수 없습니다.'
                });
            }

            const message = await ContactMessages.markAsRead(messageId);

            res.json({
                success: true,
                message: '메시지가 읽음 처리되었습니다.',
                data: message
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '메시지 읽음 처리에 실패했습니다.'
            });
        }
    }
);

router.delete('/contacts/:id',
    authenticateToken,
    requirePermission('contacts.delete'),
    logActivity('delete_contact'),
    async (req, res) => {
        try {
            const messageId = parsePositiveIntegerParam(req.params.id);

            if (!messageId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 메시지 ID가 필요합니다.'
                });
            }

            const existingMessage = await ContactMessages.getById(messageId);
            if (!existingMessage) {
                return res.status(404).json({
                    success: false,
                    message: '삭제할 메시지를 찾을 수 없습니다.'
                });
            }

            await ContactMessages.delete(messageId);

            res.json({
                success: true,
                message: '메시지가 성공적으로 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('연락처 메시지 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '메시지 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
