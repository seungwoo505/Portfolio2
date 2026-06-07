const express = require('express');
const ContactMessages = require('../../models/contact-messages');
const {
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

const router = express.Router();

/**
 * @swagger
 * /public/contact:
 *   post:
 *     summary: 문의 메시지 접수
 *     tags: ['Public']
 */
router.post('/contact', async (req, res) => {
    try {
        const name = normalizeContactField(req.body?.name);
        const email = normalizeContactField(req.body?.email).toLowerCase();
        const subject = normalizeContactField(req.body?.subject);
        const message = normalizeContactField(req.body?.message);

        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: '이름, 이메일, 메시지는 필수입니다.'
            });
        }

        for (const [field, value] of Object.entries({ name, email, subject, message })) {
            if (!validateContactLength(field, value)) {
                return res.status(400).json({
                    success: false,
                    message: `${CONTACT_FIELD_LABELS[field]} 길이가 허용 범위를 초과했습니다.`
                });
            }
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: '올바른 이메일 형식이 아닙니다.'
            });
        }

        const recentCount = await ContactMessages.countRecentByIp(req.ip, CONTACT_RECENT_WINDOW_HOURS);
        if (recentCount >= CONTACT_RECENT_IP_MAX) {
            res.setHeader('Cache-Control', 'no-store');
            return res.status(429).json({
                success: false,
                message: '문의 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
            });
        }

        const duplicateKey = getContactDuplicateKey({ email, message, req });
        if (!CacheUtils.claim(duplicateKey, CONTACT_DUPLICATE_TTL_SECONDS)) {
            res.setHeader('Cache-Control', 'no-store');
            return res.status(409).json({
                success: false,
                message: '같은 문의가 이미 접수되었습니다.'
            });
        }

        let id;
        try {
            id = await ContactMessages.create({
                name,
                email,
                subject: subject || null,
                message,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });
        } catch (error) {
            CacheUtils.release(duplicateKey);
            throw error;
        }

        res.setHeader('Cache-Control', 'no-store');
        return res.status(201).json({
            success: true,
            message: '메시지가 성공적으로 전송되었습니다.',
            data: { id }
        });
    } catch (error) {
        return fail(res, error, req, '메시지 전송에 실패했습니다.');
    }
});

module.exports = router;
