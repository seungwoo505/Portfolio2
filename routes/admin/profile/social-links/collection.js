const express = require('express');
const { logger, buildErrorLog } = require('../../common');
const SocialLinks = require('../../../../models/social-links');
const CacheUtils = require('../../../../utils/cache');
const { authenticateToken, requirePermission, logActivity } = require('../../../../middleware/auth');
const {
    getSocialLinkPayload,
    validateCreateSocialLinkPayload
} = require('./payload');

const router = express.Router();

router.get('/social-links',
    authenticateToken,
    requirePermission('social_links.read'),
    async (req, res) => {
        try {
            const links = await SocialLinks.getAll({ includeInactive: true });
            res.json({ success: true, data: links });
        } catch (error) {
            logger.error('소셜 링크 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '소셜 링크를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.post('/social-links',
    authenticateToken,
    requirePermission('social_links.create'),
    logActivity('create_social_link'),
    async (req, res) => {
        try {
            const body = getSocialLinkPayload(req);
            const validationError = validateCreateSocialLinkPayload(body);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            const id = await SocialLinks.create(body);
            const link = await SocialLinks.getById(id);
            CacheUtils.invalidateResources('social_links');
            res.status(201).json({
                success: true,
                message: '소셜 링크가 생성되었습니다.',
                data: link
            });
        } catch (error) {
            logger.error('소셜 링크 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '소셜 링크 생성에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
