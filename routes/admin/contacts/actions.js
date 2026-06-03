const express = require('express');
const { logger, buildErrorLog } = require('../common');
const ContactMessages = require('../../../models/contact-messages');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/admin/contacts/{id}/read:
 *   put:
 *     summary: 문의 메시지 읽음 처리
 *     tags: ['Admin - Contacts']
 * /api/admin/contacts/{id}:
 *   delete:
 *     summary: 문의 메시지 삭제
 *     tags: ['Admin - Contacts']
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
