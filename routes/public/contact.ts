import type { Request, Response, Router } from 'express';

const express = require('express');
const ContactMessages = require('../../models/contact-messages');
const {
    sendConflict,
    sendCreated,
    sendTooManyRequests
} = require('../../utils/api-response');
const {
    badRequest,
    CacheUtils,
    CONTACT_DUPLICATE_TTL_SECONDS,
    CONTACT_FIELD_LABELS,
    CONTACT_RECENT_IP_MAX,
    CONTACT_RECENT_WINDOW_HOURS,
    fail,
    getContactDuplicateKey,
    normalizeContactField,
    validateContactLength
} = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /public/contact:
 *   post:
 *     summary: 문의 메시지 접수
 *     tags:
 *       - Contact
 *     security: []
 *     description: 각 문자열의 앞뒤 공백을 제거하며 이메일은 소문자로 저장합니다. 같은 클라이언트의 중복 문의와 IP별 최근 접수 건수를 제한합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 120
 *                 example: 홍길동
 *               email:
 *                 type: string
 *                 format: email
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: hello@example.com
 *               subject:
 *                 type: string
 *                 maxLength: 255
 *                 example: 협업 문의
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 example: 프로젝트 협업을 제안드립니다.
 *             required:
 *               - name
 *               - email
 *               - message
 *     responses:
 *       '201':
 *         description: 문의 접수 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                       required:
 *                         - id
 *                     message:
 *                       type: string
 *                       example: 메시지가 성공적으로 전송되었습니다.
 *                   required:
 *                     - success
 *                     - data
 *       '400':
 *         description: 요청 값 또는 형식이 올바르지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '408':
 *         description: 요청 처리 시간 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: 같은 이메일, 메시지, 클라이언트의 문의가 중복 접수됨
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: 요청 횟수 제한 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 처리 중 오류 발생
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '503':
 *         description: 중복 접수 방지를 보장할 수 없어 일시적으로 요청을 처리할 수 없음
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: no-store
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/contact', async (req: Request, res: Response) => {
    try {
        for (const field of Object.keys(CONTACT_FIELD_LABELS) as Array<keyof typeof CONTACT_FIELD_LABELS>) {
            const value = req.body?.[field];
            if (value !== undefined && value !== null && typeof value !== 'string') {
                return badRequest(res, `${CONTACT_FIELD_LABELS[field]} 값은 문자열이어야 합니다.`);
            }
        }

        const name = normalizeContactField(req.body?.name);
        const email = normalizeContactField(req.body?.email).toLowerCase();
        const subject = normalizeContactField(req.body?.subject);
        const message = normalizeContactField(req.body?.message);

        if (!name || !email || !message) {
            return badRequest(res, '이름, 이메일, 메시지는 필수입니다.');
        }

        for (const [field, value] of Object.entries({ name, email, subject, message }) as Array<[keyof typeof CONTACT_FIELD_LABELS, string]>) {
            if (!validateContactLength(field, value)) {
                return badRequest(res, `${CONTACT_FIELD_LABELS[field]} 길이가 허용 범위를 초과했습니다.`);
            }
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return badRequest(res, '올바른 이메일 형식이 아닙니다.');
        }

        const duplicateKey = getContactDuplicateKey({ email, message, req });
        if (!CacheUtils.claim(duplicateKey, CONTACT_DUPLICATE_TTL_SECONDS)) {
            res.setHeader('Cache-Control', 'no-store');
            return sendConflict(res, '같은 문의가 이미 접수되었습니다.');
        }

        let id;
        try {
            id = await ContactMessages.createWithRateLimit({
                name,
                email,
                subject: subject || null,
                message,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            }, { max: CONTACT_RECENT_IP_MAX, windowHours: CONTACT_RECENT_WINDOW_HOURS });
        } catch (error) {
            CacheUtils.release(duplicateKey);
            if (error.code === 'CONTACT_RATE_LIMIT_EXCEEDED') {
                res.setHeader('Cache-Control', 'no-store');
                return sendTooManyRequests(res, '문의 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
            }
            throw error;
        }

        res.setHeader('Cache-Control', 'no-store');
        return sendCreated(res, { id }, {
            message: '메시지가 성공적으로 전송되었습니다.'
        });
    } catch (error) {
        return fail(res, error, req, '메시지 전송에 실패했습니다.');
    }
});

module.exports = router;
