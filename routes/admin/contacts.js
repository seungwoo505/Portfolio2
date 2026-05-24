const express = require('express');
const router = express.Router();
const { logger, buildErrorLog } = require('./common');
const ContactMessages = require('../../models/contact-messages');
const { parsePagination } = require('../../utils/pagination');
const { toOptionalBoolean } = require('../../utils/filter-values');
const { parsePositiveIntegerParam } = require('../../utils/route-params');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');

/**
 * @swagger
 * /api/admin/contacts:
 *   get:
 *     summary: 문의 메시지 목록 조회
 *     tags: ['Admin - Contacts']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: unread
 *         schema:
 *           type: boolean
 *           description: 읽지 않은 메시지만 조회
 *     responses:
 *       200:
 *         description: 문의 목록 조회 성공
 *       500:
 *         description: 서버 오류
 */
router.get('/contacts', authenticateToken, requirePermission('contacts.read'), async (req, res) => {
    try {
        const { limit, page, offset } = parsePagination(req.query, {
            defaultLimit: 50,
            maxLimit: 1000
        });
        const unreadFilter = toOptionalBoolean(req.query.unread);
        if (!unreadFilter.isValid) {
            return res.status(400).json({
                success: false,
                message: 'unread 값은 boolean이어야 합니다.'
            });
        }
        const unreadOnly = unreadFilter.value === true;

        const [messages, total] = await Promise.all([
            unreadOnly
                ? ContactMessages.getUnread(limit, offset)
                : ContactMessages.getAll(limit, offset),
            ContactMessages.countAll({ unread: unreadOnly ? true : null })
        ]);

        res.json({
            success: true,
            data: messages,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('연락처 메시지 목록 조회 실패', buildErrorLog(error, req));
        res.status(500).json({
            success: false,
            message: '연락처 메시지를 가져오는데 실패했습니다.'
        });
    }
});

/**
 * @swagger
 * /api/admin/contacts/{id}/read:
 *   put:
 *     summary: 문의 메시지 읽음 처리
 *     tags: ['Admin - Contacts']
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
 *         description: 읽음 처리 성공
 *       500:
 *         description: 서버 오류
 * /api/admin/contacts/{id}:
 *   delete:
 *     summary: 문의 메시지 삭제
 *     tags: ['Admin - Contacts']
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
 *         description: 메시지 삭제 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
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
