const express = require('express');
const { logger, buildErrorLog } = require('../common');
const ContactMessages = require('../../../models/contact-messages');
const { parsePagination } = require('../../../utils/pagination');
const { toOptionalBoolean } = require('../../../utils/filter-values');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /admin/contacts:
 *   get:
 *     summary: 문의 메시지 목록 조회
 *     tags: ['Admin - Contacts']
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

module.exports = router;
