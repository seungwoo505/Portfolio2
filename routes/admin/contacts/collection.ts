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
 *     tags:
 *       - Admin - Contacts
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: contacts.read.'
 *     parameters:
 *       - in: query
 *         name: page
 *         description: 잘못된 값은 기본값을 사용하고 범위를 벗어나면 경곗값으로 보정합니다.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           default: 1
 *       - in: query
 *         name: limit
 *         description: 페이지당 항목 수
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 50
 *       - in: query
 *         name: unread
 *         description: true이면 읽지 않은 문의만, false 또는 생략하면 전체 문의를 반환합니다. boolean형 문자열도 허용합니다.
 *         schema:
 *           type: boolean
 *     responses:
 *       '200':
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties: {}
 *                         additionalProperties: true
 *                 - type: object
 *                   properties:
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
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
export {};
